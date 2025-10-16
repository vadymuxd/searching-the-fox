'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { saveJobsToDatabase } from '@/lib/db/jobService';
import { searchStorage } from '@/lib/localStorage';
import { Container, Stack, Text, Box, Paper } from '@mantine/core';
import Image from 'next/image';

function ConfirmCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Setting up your account...');

  useEffect(() => {
    const handlePostAuthSetup = async () => {
      try {
        const supabase = createClient();
        const userId = searchParams.get('user_id');
        const type = searchParams.get('type'); // 'email' or 'oauth'
        const confirmed = searchParams.get('confirmed'); // 'true' for email confirmations

        if (!userId) {
          throw new Error('User ID not provided');
        }

        // Verify the user is actually authenticated
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user || user.id !== userId) {
          throw new Error('Authentication verification failed');
        }

        setMessage('Account verified! Setting up your profile...');

        // Check if user has localStorage data to migrate
        const localJobs = searchStorage.loadSearchResults();
        if (localJobs && localJobs.jobs.length > 0) {
          setMessage(`Saving your ${localJobs.jobs.length} search results...`);
          try {
            const result = await saveJobsToDatabase(localJobs.jobs, userId);
            if (result.success) {
              // Clear localStorage after successful migration
              searchStorage.clearSearchData();
              setMessage(`Successfully saved ${result.jobsSaved} jobs! Redirecting...`);
            } else {
              console.error('Failed to save jobs:', result.error);
              // Don't fail the entire flow if data migration fails
              setMessage('Account setup complete! Redirecting...');
            }
          } catch (dbError) {
            console.error('Error migrating localStorage data:', dbError);
            // Don't fail the entire flow if data migration fails
            setMessage('Account setup complete! Redirecting...');
          }
        } else {
          setMessage('Account setup complete! Redirecting...');
        }

        setStatus('success');
        
        // Redirect to results page after a brief delay
        setTimeout(() => {
          router.push('/results');
        }, 2000);

      } catch (error) {
        console.error('Post-auth setup error:', error);
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'Failed to set up account');
        
        // Redirect to home page after error
        setTimeout(() => {
          router.push('/');
        }, 3000);
      }
    };

    // Only run if we have required params
    if (searchParams.get('user_id')) {
      handlePostAuthSetup();
    } else {
      setStatus('error');
      setMessage('Missing authentication information');
      setTimeout(() => {
        router.push('/');
      }, 2000);
    }
  }, [searchParams, router]);

  return (
    <Box style={{ backgroundColor: '#f8f9fa', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Container size="sm">
        <Paper p="xl" radius="md" style={{ textAlign: 'center' }}>
          <Stack gap="lg" align="center">
            {/* Logo */}
            <Box style={{ width: '100px', height: '75px' }}>
              <Image 
                src="/Searching-The-Fox.svg"
                alt="Searching The Fox logo"
                width={100}
                height={75}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </Box>
            {/* Company Name */}
            <Text 
              style={{ 
                color: '#888',
                fontSize: '1rem',
                fontWeight: 400,
                fontFamily: 'inherit',
              }}
            >
              searching the fox
            </Text>
            {/* Status Message */}
            <Stack gap="md" align="center">
              {status === 'loading' && (
                <>
                  <Text size="xl" fw={600} c="blue">
                    {message}
                  </Text>
                  <Text size="sm" c="dimmed">
                    Please wait while we set up your account...
                  </Text>
                </>
              )}
              {status === 'success' && (
                <>
                  <Text size="xl" fw={600} c="green">
                    ✓ {message}
                  </Text>
                  <Text size="sm" c="dimmed">
                    You will be redirected shortly.
                  </Text>
                </>
              )}
              {status === 'error' && (
                <>
                  <Text size="xl" fw={600} c="red">
                    ✗ Setup Failed
                  </Text>
                  <Text size="sm" c="dimmed">
                    {message}
                  </Text>
                  <Text size="sm" c="dimmed">
                    You will be redirected to the homepage.
                  </Text>
                </>
              )}
            </Stack>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}

export default function ConfirmCallbackPage() {
  return (
    <Suspense fallback={
      <Box style={{ backgroundColor: '#f8f9fa', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Text>Loading...</Text>
      </Box>
    }>
      <ConfirmCallbackContent />
    </Suspense>
  );
}