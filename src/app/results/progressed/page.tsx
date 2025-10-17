'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ProgressedJobsPage() {
  const router = useRouter();
  
  useEffect(() => {
    // Redirect to main results page, preserving the /progressed path
    router.replace('/results');
  }, [router]);

  return null;
}