'use client';

import { useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import JobsPageContent from '@/components/JobsPageContent';

export type JobStatus = 'new' | 'interested' | 'applied' | 'progressed' | 'rejected' | 'archived';

const validStatuses: JobStatus[] = ['new', 'interested', 'applied', 'progressed', 'rejected', 'archived'];

export default function ResultsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Get status from URL query parameter, default to 'new'
  const statusParam = searchParams.get('status');
  const currentStatus: JobStatus = (statusParam && validStatuses.includes(statusParam as JobStatus)) 
    ? (statusParam as JobStatus) 
    : 'new';

  // Function to change tab programmatically (called by TabNavigation)
  const handleTabChange = useCallback((newStatus: JobStatus) => {
    // Update URL query parameter without page refresh
    router.push(`/results?status=${newStatus}`, { scroll: false });
  }, [router]);

  return (
    <JobsPageContent 
      status={currentStatus} 
      onTabChange={handleTabChange}
    />
  );
}