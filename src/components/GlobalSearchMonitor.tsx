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
 */
export function GlobalSearchMonitor() {
  const { user } = useAuth();
  const { activeRun, isLoading } = useSearchStatus({
    userId: user?.id,
    enablePolling: true,
    pollingInterval: 3000, // Poll every 3 seconds
  });

  // Only show SearchRunning if there's an active search
  if (!activeRun || !isLoading) {
    return null;
  }

  return (
    <SearchRunning
      startedAt={activeRun.created_at}
      status={activeRun.status}
      site={activeRun.parameters.site}
      onComplete={() => {
        // The useSearchStatus hook already handles page refresh
        // This is just a placeholder if we need additional logic
        console.log('[GlobalSearchMonitor] Search completed');
      }}
    />
  );
}
