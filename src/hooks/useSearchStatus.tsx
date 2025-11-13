'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle, IconCheck } from '@tabler/icons-react';
import {
  getActiveSearchRun,
  subscribeToSearchRun,
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
  const previousStatusRef = useRef<SearchRunStatus | null>(null);

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

  // Handle status updates
  const handleStatusUpdate = useCallback((searchRun: SearchRun) => {
    console.log('[useSearchStatus] Status update:', searchRun.status, 'Previous:', previousStatusRef.current);
    
    const previousStatus = previousStatusRef.current;
    previousStatusRef.current = searchRun.status;

    setState((prev) => ({
      ...prev,
      activeRun: searchRun,
      isLoading: searchRun.status === 'pending' || searchRun.status === 'running',
      error: searchRun.error_message || null,
    }));

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

      // Refresh the page to show new results
      setTimeout(() => {
        window.location.reload();
      }, 500);
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

      // Clear active run after showing error
      setState((prev) => ({
        ...prev,
        activeRun: null,
        isLoading: false,
      }));
    } else if (searchRun.status === 'running' && previousStatus === 'pending') {
      console.log('[useSearchStatus] Search started running');
      // No notification needed, user already sees the loading state
    }
  }, [router, stopTimer, stopPolling, onSearchComplete, onSearchFailed]);

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
        } else if (state.activeRun) {
          // Active run disappeared - might have been deleted or completed
          console.log('[useSearchStatus] Active run no longer exists');
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
  }, [enablePolling, userId, pollingInterval, handleStatusUpdate, state.activeRun, stopTimer, stopPolling]);

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
      } else {
        console.log('[useSearchStatus] No active search run found');
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
      setState({
        activeRun: null,
        isLoading: false,
        elapsedTime: 0,
        error: 'Failed to check search status',
      });
    }
  }, [userId, calculateElapsedTime, startTimer, subscribeToRun, startPolling, stopPolling]);

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
    };
  }, [userId, checkActiveRun, stopTimer, stopPolling]);

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
  }, [userId, checkActiveRun]);

  // Method to manually start monitoring a specific run
  const monitorRun = useCallback(async (runId: string) => {
    console.log('[useSearchStatus] Manually monitoring run:', runId);
    
    try {
      const searchRun = await getActiveSearchRun(userId!);
      
      if (searchRun && searchRun.id === runId) {
        previousStatusRef.current = searchRun.status;
        
        setState({
          activeRun: searchRun,
          isLoading: true,
          elapsedTime: calculateElapsedTime(searchRun.created_at),
          error: searchRun.error_message || null,
        });

        startTimer(searchRun.created_at);
        subscribeToRun(runId);
        startPolling();
      }
    } catch (error) {
      console.error('[useSearchStatus] Error monitoring run:', error);
    }
  }, [userId, calculateElapsedTime, startTimer, subscribeToRun, startPolling]);

  // Method to clear active run (e.g., after user acknowledges error)
  const clearActiveRun = useCallback(() => {
    console.log('[useSearchStatus] Clearing active run');
    
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    
    stopTimer();
    stopPolling();
    previousStatusRef.current = null;
    
    setState({
      activeRun: null,
      isLoading: false,
      elapsedTime: 0,
      error: null,
    });
  }, [stopTimer, stopPolling]);

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
