'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle, IconCheck } from '@tabler/icons-react';
import {
  getActiveSearchRun,
  subscribeToSearchRun,
  updateSearchRunStatus,
  SearchRun,
  SearchRunStatus,
} from '@/lib/db/searchRunService';

interface UseSearchStatusOptions {
  userId?: string;
  onSearchComplete?: () => void;
  onSearchFailed?: (error: string) => void;
  pollingInterval?: number; // Polling interval in milliseconds (default: 3000ms / 3s)
  enablePolling?: boolean; // Enable polling in addition to real-time updates (default: true)
}

interface SearchStatusState {
  activeRun: SearchRun | null;
  isLoading: boolean;
  elapsedTime: number;
  error: string | null;
}

/**
 * Hook to manage search run status and real-time updates
 * Handles cross-device search visibility and automatic status updates
 * Uses both real-time subscriptions and periodic polling for reliability
 */
export function useSearchStatus(options: UseSearchStatusOptions = {}) {
  const { 
    userId, 
    onSearchComplete, 
    onSearchFailed,
    pollingInterval = 3000, // Poll every 3 seconds by default
    enablePolling = true, // Enable polling by default
  } = options;
  const router = useRouter();
  
  const [state, setState] = useState<SearchStatusState>({
    activeRun: null,
    isLoading: false,
    elapsedTime: 0,
    error: null,
  });

  const unsubscribeRef = useRef<(() => void) | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutCheckRef = useRef<NodeJS.Timeout | null>(null);
  const previousStatusRef = useRef<SearchRunStatus | null>(null);
  const activeRunRef = useRef<SearchRun | null>(null); // Track active run to avoid state dependency

  // Calculate elapsed time based on created_at timestamp
  const calculateElapsedTime = useCallback((createdAt: string): number => {
    const startTime = new Date(createdAt).getTime();
    const now = Date.now();
    return Math.floor((now - startTime) / 1000); // Return seconds
  }, []);

  // Start elapsed time timer
  const startTimer = useCallback((createdAt: string) => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    // Update elapsed time every second
    timerRef.current = setInterval(() => {
      setState((prev) => ({
        ...prev,
        elapsedTime: calculateElapsedTime(createdAt),
      }));
    }, 1000);
  }, [calculateElapsedTime]);

  // Stop elapsed time timer
  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollingTimerRef.current) {
      console.log('[useSearchStatus] Stopping polling');
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
  }, []);

  // Stop timeout check
  const stopTimeoutCheck = useCallback(() => {
    if (timeoutCheckRef.current) {
      console.log('[useSearchStatus] Stopping timeout check');
      clearTimeout(timeoutCheckRef.current);
      timeoutCheckRef.current = null;
    }
  }, []);

  // Check if search run has been pending for too long (>2 minutes)
  const checkPendingTimeout = useCallback(async (searchRun: SearchRun) => {
    if (searchRun.status !== 'pending') {
      stopTimeoutCheck();
      return;
    }

    const createdAt = new Date(searchRun.created_at).getTime();
    const now = Date.now();
    const elapsedMinutes = (now - createdAt) / (1000 * 60);

    console.log('[useSearchStatus] Checking pending timeout, elapsed:', elapsedMinutes.toFixed(2), 'minutes');

    if (elapsedMinutes >= 2) {
      console.log('[useSearchStatus] Search run stuck in pending for >2 minutes, marking as failed');
      
      // Update search run to failed status
      try {
        const updated = await updateSearchRunStatus({
          runId: searchRun.id,
          status: 'failed',
          error: 'Search timed out - API service failed to wake up',
        });

        if (updated) {
          console.log('[useSearchStatus] Successfully marked search run as failed');
          // The status update will trigger handleStatusUpdate via subscription
        } else {
          console.error('[useSearchStatus] Failed to update search run status');
        }
      } catch (error) {
        console.error('[useSearchStatus] Error updating search run status:', error);
      }
      
      stopTimeoutCheck();
    }
  }, [stopTimeoutCheck]);

  // Start timeout check for pending status
  const startTimeoutCheck = useCallback((searchRun: SearchRun) => {
    if (searchRun.status !== 'pending') {
      return;
    }

    // Clear existing timeout check
    if (timeoutCheckRef.current) {
      clearTimeout(timeoutCheckRef.current);
    }

    const createdAt = new Date(searchRun.created_at).getTime();
    const now = Date.now();
    const elapsedMs = now - createdAt;
    const timeoutMs = 2 * 60 * 1000; // 2 minutes
    const remainingMs = Math.max(0, timeoutMs - elapsedMs);

    console.log('[useSearchStatus] Starting timeout check, will check in', (remainingMs / 1000).toFixed(0), 'seconds');

    // Schedule timeout check
    timeoutCheckRef.current = setTimeout(() => {
      checkPendingTimeout(searchRun);
    }, remainingMs);
  }, [checkPendingTimeout]);

  // Handle status updates
  const handleStatusUpdate = useCallback((searchRun: SearchRun) => {
    console.log('[useSearchStatus] Status update:', searchRun.status, 'Previous:', previousStatusRef.current);
    
    const previousStatus = previousStatusRef.current;
    previousStatusRef.current = searchRun.status;
    activeRunRef.current = searchRun; // Update ref

    setState((prev) => ({
      ...prev,
      activeRun: searchRun,
      isLoading: searchRun.status === 'pending' || searchRun.status === 'running',
      error: searchRun.error_message || null,
    }));

    // Start timeout check for pending status
    if (searchRun.status === 'pending') {
      startTimeoutCheck(searchRun);
    } else {
      stopTimeoutCheck();
    }

    // Handle status transitions
    if (searchRun.status === 'success' && previousStatus !== 'success') {
      console.log('[useSearchStatus] Search completed successfully');
      stopTimer();
      stopPolling();
      
      // Show success notification
      notifications.show({
        title: 'Search completed',
        message: `Found ${searchRun.jobs_found || 0} jobs`,
        icon: <IconCheck size={16} />,
        color: 'green',
        autoClose: 3000,
      });

      // Call callback if provided
      if (onSearchComplete) {
        onSearchComplete();
      }

      // Note: Page reload is handled immediately in SearchRunning component
      // when it detects success status
    } else if (searchRun.status === 'failed' && previousStatus !== 'failed') {
      console.log('[useSearchStatus] Search failed:', searchRun.error_message);
      stopTimer();
      stopPolling();
      
      // Show error notification
      notifications.show({
        title: 'Search failed',
        message: searchRun.error_message || 'An unexpected error occurred',
        icon: <IconAlertCircle size={16} />,
        color: 'red',
        autoClose: 5000,
      });

      // Call callback if provided
      if (onSearchFailed) {
        onSearchFailed(searchRun.error_message || 'Unknown error');
      }

      // Note: Page reload is handled immediately in SearchRunning component
      // when it detects failed status. The activeRun stays in state to allow
      // the component to trigger the reload, then will be cleared after page reloads.
    } else if (searchRun.status === 'running' && previousStatus === 'pending') {
      console.log('[useSearchStatus] Search started running');
      // No notification needed, user already sees the loading state
    }
  }, [router, stopTimer, stopPolling, stopTimeoutCheck, startTimeoutCheck, onSearchComplete, onSearchFailed]);

  // Subscribe to search run updates
  const subscribeToRun = useCallback((runId: string) => {
    console.log('[useSearchStatus] Subscribing to run:', runId);
    
    // Unsubscribe from previous subscription if exists
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    // Subscribe to real-time updates
    const unsubscribe = subscribeToSearchRun(runId, handleStatusUpdate);
    unsubscribeRef.current = unsubscribe;
  }, [handleStatusUpdate]);

  // Start polling for status updates
  const startPolling = useCallback(() => {
    if (!enablePolling || !userId) {
      return;
    }

    // Clear existing polling timer
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
    }

    console.log('[useSearchStatus] Starting polling with interval:', pollingInterval);

    // Poll immediately and then on interval
    const poll = async () => {
      try {
        const activeRun = await getActiveSearchRun(userId);
        
        if (activeRun) {
          // Update state with latest data
          handleStatusUpdate(activeRun);
        } else if (activeRunRef.current) {
          // Active run disappeared - might have been deleted or completed
          console.log('[useSearchStatus] Active run no longer exists');
          activeRunRef.current = null;
          setState({
            activeRun: null,
            isLoading: false,
            elapsedTime: 0,
            error: null,
          });
          stopTimer();
        }
      } catch (error) {
        console.error('[useSearchStatus] Polling error:', error);
      }
    };

    // Start polling
    pollingTimerRef.current = setInterval(poll, pollingInterval);
  }, [enablePolling, userId, pollingInterval, handleStatusUpdate, stopTimer]);

  // Check for active search run
  const checkActiveRun = useCallback(async () => {
    if (!userId) {
      console.log('[useSearchStatus] No userId, skipping active run check');
      return;
    }

    console.log('[useSearchStatus] Checking for active search run for user:', userId);
    
    try {
      const activeRun = await getActiveSearchRun(userId);
      
      if (activeRun) {
        console.log('[useSearchStatus] Found active run:', activeRun.id, 'Status:', activeRun.status);
        
        // Initialize previous status
        previousStatusRef.current = activeRun.status;
        activeRunRef.current = activeRun;
        
        // Set state with active run
        setState({
          activeRun,
          isLoading: true,
          elapsedTime: calculateElapsedTime(activeRun.created_at),
          error: activeRun.error_message || null,
        });

        // Start timer
        startTimer(activeRun.created_at);

        // Subscribe to updates
        subscribeToRun(activeRun.id);

        // Start polling as fallback
        startPolling();
        
        // Start timeout check if pending
        if (activeRun.status === 'pending') {
          startTimeoutCheck(activeRun);
        }
      } else {
        console.log('[useSearchStatus] No active search run found');
        activeRunRef.current = null;
        setState({
          activeRun: null,
          isLoading: false,
          elapsedTime: 0,
          error: null,
        });
        stopPolling();
      }
    } catch (error) {
      console.error('[useSearchStatus] Error checking active run:', error);
      activeRunRef.current = null;
      setState({
        activeRun: null,
        isLoading: false,
        elapsedTime: 0,
        error: 'Failed to check search status',
      });
    }
  }, [userId, calculateElapsedTime, startTimer, subscribeToRun, startPolling, startTimeoutCheck, stopPolling]);

  // Check for active run on mount and when userId changes
  useEffect(() => {
    if (userId) {
      checkActiveRun();
    }

    // Cleanup on unmount
    return () => {
      if (unsubscribeRef.current) {
        console.log('[useSearchStatus] Unsubscribing from search run updates');
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      stopTimer();
      stopPolling();
      stopTimeoutCheck();
    };
    // Only re-run when userId changes, not when callbacks change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Re-check when page becomes visible (user returns to tab)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && userId) {
        console.log('[useSearchStatus] Page visible again, re-checking active runs');
        checkActiveRun();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
    // Only re-run when userId changes, not when checkActiveRun changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Method to manually start monitoring a specific run
  const monitorRun = useCallback(async (runId: string) => {
    console.log('[useSearchStatus] Manually monitoring run:', runId);
    
    try {
      const searchRun = await getActiveSearchRun(userId!);
      
      if (searchRun && searchRun.id === runId) {
        previousStatusRef.current = searchRun.status;
        activeRunRef.current = searchRun;
        
        setState({
          activeRun: searchRun,
          isLoading: true,
          elapsedTime: calculateElapsedTime(searchRun.created_at),
          error: searchRun.error_message || null,
        });

        startTimer(searchRun.created_at);
        subscribeToRun(runId);
        startPolling();
        
        // Start timeout check if pending
        if (searchRun.status === 'pending') {
          startTimeoutCheck(searchRun);
        }
      }
    } catch (error) {
      console.error('[useSearchStatus] Error monitoring run:', error);
    }
  }, [userId, calculateElapsedTime, startTimer, subscribeToRun, startPolling, startTimeoutCheck]);

  // Method to clear active run (e.g., after user acknowledges error)
  const clearActiveRun = useCallback(() => {
    console.log('[useSearchStatus] Clearing active run');
    
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    
    stopTimer();
    stopPolling();
    stopTimeoutCheck();
    previousStatusRef.current = null;
    activeRunRef.current = null;
    
    setState({
      activeRun: null,
      isLoading: false,
      elapsedTime: 0,
      error: null,
    });
  }, [stopTimer, stopPolling, stopTimeoutCheck]);

  return {
    activeRun: state.activeRun,
    isLoading: state.isLoading,
    elapsedTime: state.elapsedTime,
    error: state.error,
    monitorRun,
    clearActiveRun,
    refreshStatus: checkActiveRun,
  };
}
