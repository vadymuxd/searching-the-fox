'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { migrateLocalStorageToDatabase, getLocalDataSummary } from '@/lib/db/localStorageMigration';
import { Box, Loader } from '@mantine/core';

function ConfirmCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handlePostAuthSetup = async () => {
      try {
        const supabase = createClient();
        const userId = searchParams.get('user_id');

        if (!userId) {
          throw new Error('User ID not provided');
        }

        // Verify the user is actually authenticated
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user || user.id !== userId) {
          throw new Error('Authentication verification failed');
        }

        // Check if user has localStorage data to migrate
        const dataSummary = getLocalDataSummary();
        const hasDataToMigrate = dataSummary.jobsCount > 0 || dataSummary.hasPreferences || dataSummary.hasKeywords;

        if (hasDataToMigrate) {
          try {
            await migrateLocalStorageToDatabase(userId);
          } catch (dbError) {
            console.error('Error migrating localStorage data:', dbError);
            // Don't fail the entire flow if data migration fails
          }
        }

        // Redirect to results page immediately after setup
        router.push('/results');

      } catch (error) {
        console.error('Post-auth setup error:', error);
        
        // Redirect to home page after error
        router.push('/');
      }
    };

    // Only run if we have required params
    if (searchParams.get('user_id')) {
      handlePostAuthSetup();
    } else {
      router.push('/');
    }
  }, [searchParams, router]);

  return (
    <Box
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#ffffff',
        zIndex: 5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Loader color="dark" size="md" />
    </Box>
  );
}

export default function ConfirmCallbackPage() {
  return (
    <Suspense fallback={
      <Box
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: '#ffffff',
          zIndex: 5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Loader color="dark" size="md" />
      </Box>
    }>
      <ConfirmCallbackContent />
    </Suspense>
  );
}