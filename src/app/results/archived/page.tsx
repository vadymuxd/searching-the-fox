'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ArchivedJobsPage() {
  const router = useRouter();
  
  useEffect(() => {
    // Redirect to main results page, preserving the /archived path
    router.replace('/results');
  }, [router]);

  return null;
}