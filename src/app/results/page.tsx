'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ResultsPage() {
  const router = useRouter();
  
  useEffect(() => {
    // Redirect to /results/new as that's the default view
    router.replace('/results/new');
  }, [router]);

  return null;
}