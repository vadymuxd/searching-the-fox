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
  const [message, setMessage] = useState('Confirming your email...');

  useEffect(() => {
    const handleEmailConfirmation = async () => {
      try {
        const supabase = createClient();
        // Get the tokens from URL params
        const token_hash = searchParams.get('token_hash');
        const type = searchParams.get('type');
        if (!token_hash || type !== 'email') {
          throw new Error('Invalid confirmation link');
        }
        // Verify the email confirmation token
        const { data: authData, error: authError } = await supabase.auth.verifyOtp({
          token_hash,
          type: 'email'
        });
        if (authError) {
          throw new Error(authError.message);
        }
        if (!authData.user) {
          throw new Error('User not found after confirmation');
        }
        setMessage('Email confirmed! Setting up your account...');
        // Check if user has localStorage data to migrate
        const localJobs = searchStorage.loadSearchResults();
        if (localJobs && localJobs.jobs.length > 0) {
          setMessage('Saving your search results...');
          try {
            // Save jobs to database for the newly confirmed user
            await saveJobsToDatabase(localJobs.jobs, authData.user.id);
            // Clear localStorage after successful migration
            searchStorage.clearSearchData();
            setMessage('Account setup complete! Redirecting...');
          } catch (dbError) {
            console.error('Error migrating localStorage data:', dbError);
            // Don't fail the entire flow if data migration fails
            setMessage('Email confirmed! Redirecting...');
          }
        } else {
          setMessage('Email confirmed! Redirecting...');
        }
        setStatus('success');
        // Redirect to results page after a brief delay
        setTimeout(() => {
          router.push('/results');
        }, 2000);
      } catch (error) {
        console.error('Email confirmation error:', error);
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'Failed to confirm email');
        // Redirect to home page after error
        setTimeout(() => {
          router.push('/');
        }, 3000);
      }
    };
    // Only run if we have search params, otherwise redirect to home
    if (searchParams.get('token_hash')) {
      handleEmailConfirmation();
    } else {
      setStatus('error');
      setMessage('No confirmation token provided');
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
                    ✗ Email Confirmation Failed
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