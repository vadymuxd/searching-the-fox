'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RejectedJobsPage() {
  const router = useRouter();
  
  useEffect(() => {
    // Redirect to main results page, preserving the /rejected path
    router.replace('/results');
  }, [router]);

  return null;
}