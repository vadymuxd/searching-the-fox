/**
 * Global job operation processor that runs independently of React components
 * This ensures operations continue even when components unmount
 */

import { notifications } from '@mantine/notifications';
import { IconCheck, IconAlertCircle } from '@tabler/icons-react';
import { updateJobStatus, removeUserJob } from '@/lib/db/jobService';
import { jobsDataManager } from '@/lib/jobsDataManager';
import { jobOperationStorage, JobOperationState } from '@/lib/localStorage';
import { JobStatus } from '@/types/supabase';
import { createElement } from 'react';

let isProcessing = false;
let currentNotificationId: string | null = null;
let currentUserId: string | null = null;
let processingStartTime: number = 0;

// Maximum time to consider a process "stuck" (30 seconds)
const PROCESSING_TIMEOUT = 30000;

// Set up visibility change listener to resume processing when page becomes visible
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && currentUserId) {
      console.log('JobOperationProcessor: Page became visible, checking for operations');
      // Check if there are operations to resume
      const operation = jobOperationStorage.loadOperation();
      if (operation && !operation.completed && !isProcessing) {
        console.log('JobOperationProcessor: Resuming operation after visibility change');
        processJobOperation(currentUserId);
      }
    }
  });
}

// Helper to create ProgressToast element
function createProgressToast(current: number, total: number, targetStatus: string, isComplete = false) {
  // Dynamically import ProgressToast to avoid circular dependencies
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ProgressToast = require('@/components/ProgressToast').ProgressToast;
  return createElement(ProgressToast, {
    current,
    total,
    targetStatus,
    isComplete,
  });
}

/**
 * Process a single job from the operation queue
 */
async function processSingleJob(
  job: { userJobId: string; title: string; company: string; jobId: string },
  operation: JobOperationState
): Promise<{ success: boolean; error?: string }> {
  console.log(`JobOperationProcessor: Processing job:`, job.userJobId);
  
  let result;
  
  if (operation.operationType === 'status-change' && operation.targetStatus) {
    result = await updateJobStatus(job.userJobId, operation.targetStatus as JobStatus);
  } else if (operation.operationType === 'remove') {
    result = await removeUserJob(job.userJobId);
  } else {
    result = { success: false, error: 'Invalid operation type' };
  }

  console.log(`JobOperationProcessor: Job result:`, { success: result.success, error: result.error });
  
  return result;
}

/**
 * Process a single batch of jobs (processes one job at a time, recursively)
 * This approach allows interruption and resumption
 */
async function processSingleBatch(userId: string): Promise<boolean> {
  // Update processing time to prevent timeout
  processingStartTime = Date.now();
  
  const operation = jobOperationStorage.loadOperation();
  
  // Check if there's still an ongoing operation for this user
  if (!operation || operation.completed || operation.userId !== userId) {
    console.log('JobOperationProcessor: No more operations to process');
    return false;
  }

  // Get next job that hasn't been processed yet
  const remainingJobs = operation.jobs.filter(
    j => !operation.processedJobIds.includes(j.userJobId)
  );

  if (remainingJobs.length === 0) {
    console.log('JobOperationProcessor: All jobs processed');
    await completeOperation(userId, operation);
    return false;
  }

  // Process just the next job
  const job = remainingJobs[0];
  console.log(`JobOperationProcessor: Processing job ${operation.processedJobIds.length + 1}/${operation.jobs.length}:`, job.userJobId);
  
  const result = await processSingleJob(job, operation);

  // Update progress in localStorage
  jobOperationStorage.updateProgress(job.userJobId, result.success);

  // Reload state from localStorage to get updated counts
  const updatedState = jobOperationStorage.loadOperation();
  if (!updatedState) {
    console.log('JobOperationProcessor: Operation was cleared, stopping');
    return false;
  }

  // Update notification with current progress
  updateProgressNotification(updatedState);

  // Check if there are more jobs to process
  const stillRemainingJobs = updatedState.jobs.filter(
    j => !updatedState.processedJobIds.includes(j.userJobId)
  );
  
  return stillRemainingJobs.length > 0;
}

/**
 * Start continuous processing of operations
 * Processes jobs one at a time recursively
 */
async function processLoop(userId: string): Promise<void> {
  let hasMore = true;
  
  while (hasMore) {
    hasMore = await processSingleBatch(userId);
    
    if (hasMore) {
      // Small delay between jobs to prevent overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
}

/**
 * Update the progress notification
 */
function updateProgressNotification(state: JobOperationState): void {
  const currentCount = state.successCount + state.failedCount;
  
  if (currentNotificationId) {
    notifications.update({
      id: currentNotificationId,
      message: createProgressToast(
        currentCount,
        state.jobs.length,
        state.targetStatusLabel || 'processing'
      ),
      autoClose: false,
      color: 'white',
      withCloseButton: false,
    });
  }
}

/**
 * Complete the operation and show final notification
 */
async function completeOperation(userId: string, operation: JobOperationState): Promise<void> {
  const finalState = jobOperationStorage.loadOperation();
  if (!finalState) {
    console.log('JobOperationProcessor: No final state found');
    return;
  }

  console.log('JobOperationProcessor: Operation complete', {
    successCount: finalState.successCount,
    failedCount: finalState.failedCount,
  });

  // Mark as complete
  jobOperationStorage.completeOperation();

  // Sync cache with database
  await jobsDataManager.syncWithDatabase(userId, undefined, true);

  // Dispatch custom event to update job counters
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('jobsUpdated'));
    window.dispatchEvent(new Event('jobOperationComplete'));
  }

  // Show appropriate final notification
  if (finalState.failedCount === 0) {
    // All updates successful
    if (currentNotificationId) {
      notifications.update({
        id: currentNotificationId,
        message: createProgressToast(
          finalState.successCount,
          finalState.jobs.length,
          finalState.targetStatusLabel || 'processing',
          true
        ),
        title: operation.operationType === 'remove' ? 'Jobs Removed' : 'Jobs Updated',
        color: 'green',
        icon: createElement(IconCheck, { size: 16 }),
        autoClose: 3000,
        withCloseButton: true,
      });
    }
  } else {
    // Some updates failed
    if (currentNotificationId) {
      notifications.update({
        id: currentNotificationId,
        title: operation.operationType === 'remove' ? 'Partial Removal' : 'Partial Update',
        message: `${finalState.successCount} job${finalState.successCount !== 1 ? 's' : ''} ${
          operation.operationType === 'remove' ? 'removed' : 'updated'
        } successfully, ${finalState.failedCount} failed`,
        color: 'yellow',
        icon: createElement(IconAlertCircle, { size: 16 }),
        autoClose: 5000,
        withCloseButton: true,
      });
    }
  }
}

/**
 * Process jobs from an operation, continuing from where it left off
 */
export async function processJobOperation(userId: string): Promise<boolean> {
  // Store current user ID for visibility change handler
  currentUserId = userId;
  
  // Check if processing is genuinely stuck (timeout), if so, reset the flag
  const now = Date.now();
  if (isProcessing && (now - processingStartTime) > PROCESSING_TIMEOUT) {
    console.log('JobOperationProcessor: Processing appears stuck, resetting flag');
    isProcessing = false;
  }
  
  // Prevent concurrent processing
  if (isProcessing) {
    console.log('JobOperationProcessor: Already processing (started', (now - processingStartTime) / 1000, 'seconds ago)');
    return false;
  }

  const operation = jobOperationStorage.loadOperation();
  
  console.log('JobOperationProcessor: Checking for operations', { operation, userId });
  
  // Check if there's an ongoing operation for this user
  if (!operation || operation.completed || operation.userId !== userId) {
    console.log('JobOperationProcessor: No valid operation to resume');
    return false;
  }

  isProcessing = true;
  processingStartTime = Date.now();

  // Get jobs that haven't been processed yet
  const remainingJobs = operation.jobs.filter(
    j => !operation.processedJobIds.includes(j.userJobId)
  );

  console.log('JobOperationProcessor: Processing operation', {
    totalJobs: operation.jobs.length,
    remainingJobs: remainingJobs.length,
    processed: operation.processedJobIds.length,
    successCount: operation.successCount,
    failedCount: operation.failedCount,
  });

  if (remainingJobs.length === 0) {
    // All jobs already processed, mark as complete
    console.log('JobOperationProcessor: All jobs processed, completing');
    await completeOperation(userId, operation);
    isProcessing = false;
    return true;
  }

  try {
    // Show initial progress notification
    const currentProgress = operation.successCount + operation.failedCount;
    currentNotificationId = notifications.show({
      message: createProgressToast(
        currentProgress,
        operation.jobs.length,
        operation.targetStatusLabel || 'processing'
      ),
      autoClose: false,
      color: 'white',
      withCloseButton: false,
    });

    // Start the processing loop - this will continue even if component unmounts
    // because it's running at the module level, not tied to React lifecycle
    await processLoop(userId);

    isProcessing = false;
    return true;
  } catch (error) {
    console.error('JobOperationProcessor: Error processing operation:', error);
    notifications.show({
      title: 'Operation Failed',
      message: 'Failed to complete the job operation. Please try again.',
      color: 'red',
    });
    jobOperationStorage.clearOperation();
    isProcessing = false;
    return false;
  }
}

/**
 * Check if there's currently an operation being processed
 */
export function isOperationInProgress(): boolean {
  return isProcessing;
}

/**
 * Get the current operation state
 */
export function getCurrentOperation(): JobOperationState | null {
  return jobOperationStorage.loadOperation();
}
