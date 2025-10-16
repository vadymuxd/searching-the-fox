'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Container,
  Stack,
  Text,
  Box,
  Paper,
  Alert,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle } from '@tabler/icons-react';
import { SearchForm } from '@/components/SearchForm';
import { AuthModal } from '@/components/AuthModal';
import { AuthButton } from '@/components/AuthButton';
import { Header } from '@/components/Header';
import { Timer } from '@/components/Timer';
import { LoadingInsightWithIcon as LoadingInsight } from '@/components/LoadingInsight';
import { JobService } from '@/lib/api';
import { searchStorage } from '@/lib/localStorage';
import { saveJobsToDatabase } from '@/lib/db/jobService';
import { saveLastSearch } from '@/lib/db/userPreferences';
import { SearchFormData, JobSearchResponse } from '@/types/job';
import { useAuth } from '@/lib/auth/AuthContext';

export default function HomePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [currentSearch, setCurrentSearch] = useState<SearchFormData | null>(null);
  const [mounted, setMounted] = useState(false);
  const [authModalOpened, setAuthModalOpened] = useState(false);
  const [emailNotConfirmed, setEmailNotConfirmed] = useState(false);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progressInfo, setProgressInfo] = useState<{
    currentSite: string;
    completed: number;
    total: number;
  } | undefined>(undefined);

  // Don't auto-redirect authenticated users - let them use homepage too
  useEffect(() => {
    // Removed automatic redirect to /results
    // Both authenticated and guest users can use the homepage for new searches
  }, [user, authLoading, router]);

  // React to user changes from AuthContext
  useEffect(() => {
    // Skip if this is the initial mount and we haven't finished loading
    if (!mounted) return;
    
    console.log('User changed from AuthContext:', user);
    console.log('Email confirmed:', user?.email_confirmed_at);
    
    // Check if user exists but email is not confirmed
    if (user && !user.email_confirmed_at) {
      console.log('User email not confirmed - showing confirmation screen');
      setEmailNotConfirmed(true);
      return;
    }
    
    setEmailNotConfirmed(false);
    setUnconfirmedEmail(null);
    
    // If user is signed in and email is confirmed, they can still use homepage
    if (user && user.email_confirmed_at) {
      console.log('User email confirmed - can use homepage for new searches');
    }
  }, [user, mounted, router]);

  // Listen for custom email confirmation events
  useEffect(() => {
    const handleShowEmailConfirmation = (event: CustomEvent) => {
      console.log('Received showEmailConfirmation event:', event.detail);
      setEmailNotConfirmed(true);
      setUnconfirmedEmail(event.detail.email);
    };

    window.addEventListener('showEmailConfirmation', handleShowEmailConfirmation as EventListener);
    
    return () => {
      window.removeEventListener('showEmailConfirmation', handleShowEmailConfirmation as EventListener);
    };
  }, []);

  // Load saved data on component mount
  useEffect(() => {
    setMounted(true);
    
    // Load search data from localStorage for both authenticated and guest users
    // This handles both regular guest usage and "Edit search" functionality
    const savedSearchData = searchStorage.loadSearchData();
    if (savedSearchData) {
      setCurrentSearch(savedSearchData);
    }
  }, []);

  // Check for trigger search after mount
  useEffect(() => {
    if (!mounted) return;
    
    // Check if we need to trigger immediate search (from refresh button)
    const triggerSearchData = localStorage.getItem('triggerSearch');
    if (triggerSearchData) {
      try {
        const searchData = JSON.parse(triggerSearchData);
        localStorage.removeItem('triggerSearch');
        // Trigger search after a short delay to ensure component is ready
        setTimeout(() => {
          handleSearch(searchData);
        }, 100);
      } catch (error) {
        console.error('Error parsing triggerSearch data:', error);
        localStorage.removeItem('triggerSearch');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  const handleSearch = useCallback(async (searchData: SearchFormData) => {
    // Migrate localStorage data if user just signed in
    if (user) {
      const localJobs = searchStorage.loadSearchResults();
      if (localJobs && localJobs.jobs.length > 0) {
        try {
          await saveJobsToDatabase(localJobs.jobs, user.id);
          console.log('Migrated localStorage jobs to database');
          // Clear localStorage after successful migration
          searchStorage.clearSearchData();
        } catch (error) {
          console.error('Error migrating localStorage jobs:', error);
        }
      }
    }
    
    setLoading(true);
    setCurrentSearch(searchData);
    setError(null);
    setProgressInfo(undefined);

    // Save search data to localStorage
    searchStorage.saveSearchData(searchData);

    // Save search parameters to database if user is authenticated
    if (user) {
      try {
        await saveLastSearch(user.id, searchData);
      } catch (error) {
        console.error('Error saving search to database:', error);
      }
    }

    try {
      let response: JobSearchResponse;
      
      if (searchData.site === 'all') {
        // Handle "All Job Boards" selection
        response = await JobService.searchAllJobBoards(
          {
            location: searchData.location,
            job_title: searchData.jobTitle,
            results_wanted: searchData.resultsWanted,
            hours_old: searchData.hoursOld,
          },
          (currentSite: string, completed: number, total: number) => {
            setProgressInfo({
              currentSite,
              completed,
              total,
            });
          }
        );
      } else {
        // Handle single job board selection
        response = await JobService.searchJobs({
          site: searchData.site,
          location: searchData.location,
          job_title: searchData.jobTitle,
          results_wanted: searchData.resultsWanted,
          hours_old: searchData.hoursOld,
        });
      }

      if (response.success) {
        // Auto-save to database for authenticated users
        if (user) {
          await saveJobsToDatabase(response.jobs, user.id);
        } else {
          // Save to localStorage for anonymous users
          searchStorage.saveSearchResults({
            jobs: response.jobs,
            searchStarted: true,
            searchData: searchData,
          });
        }
        
        // Redirect to new jobs page immediately
        router.push('/results/new');
      } else {
        throw new Error(response.error || 'Failed to search jobs');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      
      // Show error notification
      notifications.show({
        title: 'Search failed',
        message: errorMessage,
        icon: <IconAlertCircle size={16} />,
        color: 'red',
        autoClose: 5000,
      });
    } finally {
      setLoading(false);
      setProgressInfo(undefined);
    }
  }, [user, router]);

  return (
    <>
      {/* Header - Show only during loading */}
      {loading && <Header onSignInClick={() => setAuthModalOpened(true)} />}
      
      {/* Email Confirmation Required State */}
      {emailNotConfirmed ? (
        <Box style={{ backgroundColor: '#f8f9fa', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Container size="sm">
            <Stack gap="lg" align="center" ta="center">
              {/* Email Confirmation Message */}
              <Stack gap="md" align="center">
                <Text size="xl" fw={600} c="blue">
                  Please Confirm Your Email
                </Text>
                <Text size="md" c="dimmed" maw={400}>
                  We&apos;ve sent a confirmation email to {unconfirmedEmail ? <strong>{unconfirmedEmail}</strong> : 'your inbox'}. Please check your email and click the confirmation link to activate your account.
                </Text>
                <Text size="sm" c="dimmed">
                  Don&apos;t see the email? Check your spam folder or contact support if you need help.
                </Text>
              </Stack>
            </Stack>
          </Container>
        </Box>
      ) : !mounted ? (
        // Show loading skeleton during hydration
        <Box style={{ backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
          <Container size="xl" style={{ minHeight: '100vh' }}>
            <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
              <Box style={{ width: '100%' }}>
                <Stack gap="0" align="center">
                  {/* Fox Logo */}
                  <Box style={{ width: '100px', height: '75px', marginBottom: '12px' }}>
                    <Image 
                      src="/Searching-The-Fox.svg"
                      alt="Searching The Fox logo"
                      width={100}
                      height={75}
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  </Box>
                  {/* Auth Button */}
                  <Box style={{ marginBottom: '12px' }}>
                    <AuthButton onSignInClick={() => setAuthModalOpened(true)} />
                  </Box>
                  {/* Headline as body text, grey */}
                  <Text 
                    ta="center" 
                    mb="lg" 
                    style={{ 
                      color: '#888',
                      fontSize: '1rem',
                      fontWeight: 400,
                      fontFamily: 'inherit',
                    }}
                  >
                    searching the fox
                  </Text>
                </Stack>
              </Box>
            </Box>
          </Container>
        </Box>
      ) : (
        // Main homepage layout - centered search form or loading state
        <Box style={{ backgroundColor: loading ? '#ffffff' : '#f8f9fa', minHeight: '100vh', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Box style={{ width: '100%' }}>
            {loading ? (
              // Loading state with progress
              <Container size="xl">
                <Stack gap="xl" align="center">
                  {/* Loading Progress */}
                  <Paper p="md" radius="md" style={{ width: '100%', maxWidth: '600px' }}>
                    <Stack gap={8} align="center">
                      <LoadingInsight isActive={loading} />
                      <Timer 
                        isRunning={loading} 
                        progressInfo={progressInfo}
                      />
                      {!progressInfo && (
                        <Text size="sm" c="dimmed" ta="center">
                          This may take up to 2 minutes depending on the job board and number of results
                        </Text>
                      )}
                    </Stack>
                  </Paper>

                  {/* Error Alert during loading */}
                  {error && (
                    <Alert 
                      icon={<IconAlertCircle size={16} />} 
                      title="Search Error" 
                      color="red"
                      variant="light"
                      style={{ width: '100%', maxWidth: '600px' }}
                      styles={{
                        message: { fontSize: '14px' }
                      }}
                    >
                      {error}
                    </Alert>
                  )}
                </Stack>
              </Container>
            ) : (
              // Initial search form state
              <Stack gap="0" align="center">
                {/* Fox Logo */}
                <Box style={{ width: '100px', height: '75px', marginBottom: '12px' }}>
                  <Image 
                    src="/Searching-The-Fox.svg"
                    alt="Searching The Fox logo"
                    width={100}
                    height={75}
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                </Box>
                {/* Auth Button */}
                <Box style={{ marginBottom: '12px' }}>
                  <AuthButton onSignInClick={() => setAuthModalOpened(true)} />
                </Box>
                {/* Headline as body text, grey */}
                <Text 
                  ta="center" 
                  mb="sm" 
                  style={{ 
                    color: '#888',
                    fontSize: '1rem',
                    fontWeight: 400,
                    fontFamily: 'inherit',
                  }}
                >
                  searching the fox
                </Text>
                {/* Job Site Icons */}
                <Box style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                  <Image 
                    src="/indeed.svg" 
                    alt="Indeed" 
                    width={24}
                    height={24}
                    style={{ opacity: 0.2 }}
                  />
                  <Image 
                    src="/Linkedin.svg" 
                    alt="LinkedIn" 
                    width={24}
                    height={24}
                    style={{ opacity: 0.2 }}
                  />
                </Box>
                {/* Search Form */}
                <Box style={{ width: '100%', maxWidth: '1280px', margin: '0 auto', padding: '0 16px' }}>
                  <SearchForm
                    onSearch={handleSearch}
                    loading={loading}
                    initialValues={currentSearch || undefined}
                  />
                </Box>
              </Stack>
            )}
          </Box>
        </Box>
      )}
      
      {/* Auth Modal */}
      <AuthModal 
        opened={authModalOpened} 
        onClose={() => setAuthModalOpened(false)}
        hasSearchResults={false}
      />
    </>
  );
}
