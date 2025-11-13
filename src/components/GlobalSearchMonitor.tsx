'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { useSearchStatus } from '@/hooks/useSearchStatus';
import { SearchRunning } from './SearchRunning';

/**
 * Global component that monitors for active search runs
 * and displays the SearchRunning component when a search is in progress.
 * This component is rendered in the root layout to ensure
 * the search status is visible across all pages.
 * 
 * Exposes refreshStatus globally via window object for manual triggering.
 */
export function GlobalSearchMonitor() {
  const { user } = useAuth();
  const { activeRun, isLoading, refreshStatus } = useSearchStatus({
    userId: user?.id,
    enablePolling: true,
    pollingInterval: 3000, // Poll every 3 seconds
  });

  // Expose refreshStatus globally so other components can trigger a check
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as { __searchStatus_refresh?: () => Promise<void> }).__searchStatus_refresh = refreshStatus;
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as { __searchStatus_refresh?: () => Promise<void> }).__searchStatus_refresh;
      }
    };
  }, [refreshStatus]);

  // Only show SearchRunning if there's an active search
  // When status is "success" or "failed", the component will immediately reload the page
  if (!activeRun) {
    return null;
  }

  return (
    <SearchRunning
      startedAt={activeRun.created_at}
      status={activeRun.status}
      site={activeRun.parameters.site}
      onComplete={() => {
        console.log('[GlobalSearchMonitor] SearchRunning completed, page will reload');
      }}
    />
  );
}
