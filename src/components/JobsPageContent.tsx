'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Container,
  Stack,
  Text,
  Alert,
  Box,
  Group,
  SimpleGrid,
  Button,
} from '@mantine/core';
import { useMantineTheme } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconInfoCircle, IconAlertCircle, IconRefresh, IconEdit } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { JobTable } from '@/components/JobTable';
import { JobCard } from '@/components/JobCard';
import { PageFilter } from '@/components/PageFilter';
import { SortDropdown, SortOption } from '@/components/SortDropdown';
import { AuthModal } from '@/components/AuthModal';
import { Header } from '@/components/Header';
import { TabNavigation } from '@/components/TabNavigation';
import { MoveToButton } from '@/components/MoveToButton';
import { searchStorage } from '@/lib/localStorage';
import { getUserJobs } from '@/lib/db/jobService';
import { getUserPreferences, saveLastSearch } from '@/lib/db/userPreferences';
import { Job, SearchFormData } from '@/types/job';
import { useAuth } from '@/lib/auth/AuthContext';
import { SITE_OPTIONS } from '@/lib/api';
import { createClient } from '@/lib/supabase/client';

interface JobsPageContentProps {
  status?: 'new' | 'interested' | 'applied' | 'progressed' | 'rejected' | 'archived';
}

export default function JobsPageContent({ status }: JobsPageContentProps) {
  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<Job[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentSearch, setCurrentSearch] = useState<SearchFormData | null>(null);
  const [selectedJobsCount, setSelectedJobsCount] = useState(0);
  const [totalSelectedJobs, setTotalSelectedJobs] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [sortOption, setSortOption] = useState<SortOption>('posted-recent');
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());
  const [selectedJobsData, setSelectedJobsData] = useState<Array<{ userJobId: string; title: string; company: string; jobId: string }>>([]);
  const [authModalOpened, setAuthModalOpened] = useState(false);
  const [authModalForAction, setAuthModalForAction] = useState(false); // New state for action-triggered auth modal
  const [resendingEmail, setResendingEmail] = useState(false);
  
  // Track if we've already loaded data for this user to prevent re-loading on tab focus
  const userDataLoadedRef = useRef<string | null>(null);

  // Memoized callback for filtered jobs change to prevent PageFilter reloads
  const handleFilteredJobsChange = useCallback((filteredJobs: Job[]) => {
    setFilteredJobs(filteredJobs);
  }, []);

  // Redirect authenticated users to results page but allow guest users
  useEffect(() => {
    // No redirect needed - both authenticated and guest users can access results
    // Guest users will see localStorage data, authenticated users will see database data
  }, [user, authLoading, router]);

  // Load user jobs from database
  const loadUserJobsFromDb = useCallback(async (userId: string) => {
    try {
      // First, clear any existing data to ensure clean state for authenticated users
      setJobs([]);
      setFilteredJobs([]);
      setError(null);
      
      const result = await getUserJobs(userId, status);
      if (result.success) {
        setJobs(result.jobs);
        setFilteredJobs(result.jobs);
      } else {
        setJobs([]);
        setFilteredJobs([]);
        setError('Failed to load jobs from database');
      }
    } catch (error) {
      console.error('Error loading user jobs:', error);
      setJobs([]);
      setFilteredJobs([]);
      setError('Failed to load jobs from database');
    }
  }, [status]);

  // React to user changes from AuthContext
  useEffect(() => {
    // Skip if this is the initial mount and we haven't finished loading
    if (!mounted || authLoading) return;
    
    console.log('User changed from AuthContext:', user);
    console.log('Email confirmed:', user?.email_confirmed_at);
    
    // Check if user exists but email is not confirmed
    if (user && !user.email_confirmed_at) {
      console.log('User email not confirmed - redirecting to home');
      router.replace('/');
      return;
    }
    
    // If user is signed in and email is confirmed, load their data
    if (user && user.email_confirmed_at) {
      // Check if we've already loaded data for this user
      if (userDataLoadedRef.current === user.id) {
        console.log('User data already loaded, skipping reload');
        return;
      }
      
      console.log('User email confirmed - loading user data');
      userDataLoadedRef.current = user.id;
      
      // Clear any localStorage data immediately for authenticated users
      setJobs([]);
      setFilteredJobs([]);
      
      loadUserJobsFromDb(user.id);
      loadUserPreferencesFromDb(user.id);
    } else {
      // Reset the ref when user logs out or for guest users
      userDataLoadedRef.current = null;
      // For guest users, load from localStorage
      if (!user) {
        loadGuestData();
      }
    }
  }, [user, mounted, authLoading, router, status, loadUserJobsFromDb]);

  // Prevent unnecessary reloads when page regains focus/visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      // Do nothing - just prevent default behavior that might trigger reloads
      console.log('Page visibility changed, maintaining current state');
    };

    const handleFocus = () => {
      // Do nothing - just prevent default behavior that might trigger reloads
      console.log('Page focused, maintaining current state');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Load guest data from localStorage
  const loadGuestData = () => {
    const savedResults = searchStorage.loadSearchResults();
    if (savedResults) {
      setJobs(savedResults.jobs);
      setFilteredJobs(savedResults.jobs);
      setCurrentSearch(savedResults.searchData);
    } else {
      // If no results, still try to load just the search form data
      const savedSearchData = searchStorage.loadSearchData();
      if (savedSearchData) {
        setCurrentSearch(savedSearchData);
      }
    }
  };

  // Load user preferences from database
  const loadUserPreferencesFromDb = async (userId: string) => {
    try {
      const result = await getUserPreferences(userId);
      if (result.success && result.preferences?.lastSearch) {
        setCurrentSearch(result.preferences.lastSearch);
      }
    } catch (error) {
      console.error('Error loading user preferences:', error);
    }
  };

  // Load saved data on component mount
  useEffect(() => {
    setMounted(true);
    
    // Load data for guest users immediately
    if (!user) {
      loadGuestData();
    }
  }, [user]);

  // Helper function to get job ID (same as JobTable)
  const getJobId = (job: Job) => {
    return job.id || `${job.title}-${job.company}-${job.location}`;
  };

  // Sort jobs based on selected option
  const sortJobs = (jobsToSort: Job[], option: SortOption): Job[] => {
    const sorted = [...jobsToSort];
    
    switch (option) {
      case 'posted-recent':
        // Now: sort oldest first (ascending)
        return sorted.sort((a, b) => {
          const dateA = new Date(a.date_posted || '').getTime() || 0;
          const dateB = new Date(b.date_posted || '').getTime() || 0;
          return dateA - dateB;
        });
      case 'posted-old':
        // Now: sort newest first (descending)
        return sorted.sort((a, b) => {
          const dateA = new Date(a.date_posted || '').getTime() || 0;
          const dateB = new Date(b.date_posted || '').getTime() || 0;
          return dateB - dateA;
        });
      case 'company-asc':
        return sorted.sort((a, b) => a.company.localeCompare(b.company));
      case 'company-desc':
        return sorted.sort((a, b) => b.company.localeCompare(a.company));
      case 'title-asc':
        return sorted.sort((a, b) => a.title.localeCompare(b.title));
      case 'title-desc':
        return sorted.sort((a, b) => b.title.localeCompare(a.title));
      default:
        return sorted;
    }
  };

  // Mobile-specific selection handler
  const handleMobileSelectionChange = (jobId: string, selected: boolean) => {
    const newSelected = new Set(selectedJobs);
    if (selected) {
      newSelected.add(jobId);
    } else {
      newSelected.delete(jobId);
    }
    setSelectedJobs(newSelected);
    
    // Update counts
    setSelectedJobsCount(newSelected.size);
    setTotalSelectedJobs(newSelected.size);

    // Update selected jobs data for mobile
    const selectedJobsData = filteredJobs
      .filter(job => {
        const jobKey = getJobId(job);
        return newSelected.has(jobKey);
      })
      .map(job => ({
        userJobId: job.user_job_id || '',
        title: job.title,
        company: job.company,
        jobId: getJobId(job),
      }));
      // Don't filter out jobs without user_job_id to support non-authenticated users

    setSelectedJobsData(selectedJobsData);
  };

  const handleEditSearch = async () => {
    // For authenticated users, save current search to user preferences before redirecting
    if (user && currentSearch) {
      try {
        // Save to both localStorage (for immediate homepage use) and database (for persistence)
        searchStorage.saveSearchData(currentSearch);
        await saveLastSearch(user.id, currentSearch);
      } catch (error) {
        console.error('Error saving search preferences:', error);
      }
    } else if (currentSearch) {
      // For guest users, just save to localStorage
      searchStorage.saveSearchData(currentSearch);
    }
    // Navigate to homepage to edit search
    router.push('/');
  };

  const handleRefresh = () => {
    // Navigate to homepage and trigger immediate search
    if (currentSearch) {
      // Store flag in localStorage to trigger immediate search
      localStorage.setItem('triggerSearch', JSON.stringify(currentSearch));
    }
    router.push('/');
  };

  const handleSelectionChange = useCallback((selectedCount: number) => {
    setSelectedJobsCount(selectedCount);
    setTotalSelectedJobs(selectedCount);
  }, []);

  const handleSelectedJobsChange = useCallback((selectedJobsData: Array<{ userJobId: string; title: string; company: string; jobId: string }>) => {
    setSelectedJobsData(selectedJobsData);
  }, []);

  // Handler for auth required actions
  const handleAuthRequired = useCallback(() => {
    setAuthModalForAction(true);
  }, []);

  // Function to resend confirmation email
  const handleResendConfirmation = async () => {
    if (!user?.email || resendingEmail) return;
    
    setResendingEmail(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: user.email
      });
      
      if (error) {
        notifications.show({
          title: 'Failed to resend email',
          message: error.message,
          color: 'red',
          icon: <IconAlertCircle size={16} />,
        });
      } else {
        notifications.show({
          title: 'Email sent!',
          message: 'We\'ve sent another confirmation email to your inbox.',
          color: 'green',
          icon: <IconAlertCircle size={16} />,
        });
      }
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to resend confirmation email.',
        color: 'red',
        icon: <IconAlertCircle size={16} />,
      });
    } finally {
      setResendingEmail(false);
    }
  };

  const handleStatusUpdate = useCallback(() => {
    // Refresh the page to show updated jobs in their new status tabs
    router.refresh();
    // Also reload user jobs from database
    if (user) {
      loadUserJobsFromDb(user.id);
    }
  }, [router, user, loadUserJobsFromDb]);

  // Helper function to get readable job board name
  const getJobBoardName = (site: string) => {
    const siteOption = SITE_OPTIONS.find(option => option.value === site);
    return siteOption ? siteOption.label : site;
  };

  // Helper function to get readable time period
  const getTimePeriod = (hoursOld: string) => {
    const timeOptions = [
      { value: '1', label: 'Past 1 hour' },
      { value: '24', label: 'Past 24 hours' },
      { value: '72', label: 'Past 3 days' },
      { value: '168', label: 'Past week' },
      { value: '720', label: 'Past month' },
    ];
    const timeOption = timeOptions.find(option => option.value === hoursOld);
    return timeOption ? timeOption.label.toLowerCase() : `past ${hoursOld} hours`;
  };
  // Show loading state while auth is being checked
  if (authLoading || !mounted) {
    return (
      <Box style={{ backgroundColor: '#f8f9fa', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Text>Loading...</Text>
      </Box>
    );
  }

  // Show email confirmation screen for unconfirmed users
  if (user && !user.email_confirmed_at) {
    return (
      <Box style={{ backgroundColor: '#f8f9fa', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Container size="sm">
          <Stack gap="lg" align="center" ta="center">
            <Stack gap="md" align="center">
              <Text size="xl" fw={600} c="blue">
                Please Confirm Your Email
              </Text>
              <Text size="md" c="dimmed" maw={400}>
                We&apos;ve sent a confirmation email to <strong>{user.email}</strong>. Please check your email and click the confirmation link to activate your account.
              </Text>
              <Text size="sm" c="dimmed">
                Don&apos;t see the email? Check your spam folder or try resending.
              </Text>
              <Button 
                variant="outline" 
                size="sm"
                loading={resendingEmail}
                onClick={handleResendConfirmation}
              >
                Resend Confirmation Email
              </Button>
            </Stack>
          </Stack>
        </Container>
      </Box>
    );
  }

  return (
    <>
      {/* Header with Logo and Auth Button */}
      <Header onSignInClick={() => setAuthModalOpened(true)} />
      
      {/* Tab Navigation - for all users */}
      <TabNavigation onAuthRequired={handleAuthRequired} />
      
      {/* Top Section - Search Summary - only show for "new" status */}
      {status === 'new' && (
        <Box 
          style={{ 
            backgroundColor: '#f8f9fa',
            borderBottom: '1px solid #dee2e6',
            padding: '24px 0'
          }}
        >
          <Container size="xl">
            {currentSearch ? (
              <Stack gap="md">
                {/* Search Summary */}
                <Text size="md" fw={500}>
                  Jobs for <strong>{currentSearch.jobTitle}</strong> in <strong>{currentSearch.location}</strong> from <strong>{getJobBoardName(currentSearch.site)}</strong> posted within <strong>{getTimePeriod(currentSearch.hoursOld)}</strong>
                </Text>
                
                {/* Action Buttons */}
                <Group gap="md">
                  <Button
                    variant="outline"
                    leftSection={<IconRefresh size={16} />}
                    onClick={handleRefresh}
                    size="sm"
                  >
                    Refresh
                  </Button>
                  <Button
                    variant="outline"
                    leftSection={<IconEdit size={16} />}
                    onClick={handleEditSearch}
                    size="sm"
                  >
                    Edit search
                  </Button>
                </Group>
              </Stack>
            ) : (
              <Text size="lg" c="dimmed">
                No search data available
              </Text>
            )}
          </Container>
        </Box>
      )}

      {/* Bottom Section - Results */}
      <Container size="xl" py="xl">
        <Stack gap="xl">
          {/* Error Alert */}
          {error && (
            <Alert 
              icon={<IconAlertCircle size={16} />} 
              title="Search Error" 
              color="red"
              variant="light"
              styles={{
                message: { fontSize: '14px' }
              }}
            >
              {error}
            </Alert>
          )}

          {/* Results */}
          {jobs.length === 0 && !error && (
            <Alert 
              icon={<IconInfoCircle size={16} />} 
              title={status ? `No ${status} jobs found` : "No Jobs Found"} 
              color="blue"
              variant="light"
              styles={{
                message: { fontSize: '14px' }
              }}
            >
              {status 
                ? `No jobs found with status "${status}".` 
                : "No jobs were found matching your criteria. Try adjusting your search terms or expanding your location."
              }
            </Alert>
          )}

          {jobs.length > 0 && (
            <Stack gap="lg">
              {/* Job Counter */}
              <Group justify="space-between" align="center">
                <Text fw={600} size="sm">
                  {filteredJobs.length} of {jobs.length} jobs shown
                </Text>
                <Group gap="md" align="center">
                  {totalSelectedJobs > 0 && (
                    <Text fw={500} size="sm" c="blue">
                      {selectedJobsCount > 0 && selectedJobsCount !== totalSelectedJobs
                        ? `${selectedJobsCount} of ${totalSelectedJobs} selected job${totalSelectedJobs !== 1 ? 's' : ''} visible`
                        : `${totalSelectedJobs} job${totalSelectedJobs !== 1 ? 's' : ''} selected`
                      }
                    </Text>
                  )}
                  {selectedJobsData.length > 0 && (
                    <MoveToButton
                      selectedJobs={selectedJobsData}
                      onStatusUpdate={handleStatusUpdate}
                      onAuthRequired={handleAuthRequired}
                    />
                  )}
                </Group>
              </Group>

              {/* Page Filter */}
              <PageFilter 
                jobs={jobs} 
                onFilteredJobsChange={handleFilteredJobsChange}
              />

              {/* Filtered Results */}
              {filteredJobs.length === 0 ? (
                <Alert 
                  icon={<IconInfoCircle size={16} />} 
                  title="No Matching Jobs" 
                  color="orange"
                  variant="light"
                  styles={{
                    message: { fontSize: '14px' }
                  }}
                >
                  No jobs match your filter criteria. Try different job title keywords or clear the filter.
                </Alert>
              ) : (
                <>
                  {isMobile ? (
                    <Stack gap="md">
                      {/* Mobile Sort Dropdown */}
                      <SortDropdown 
                        value={sortOption}
                        onChange={setSortOption}
                      />
                      
                      {/* Mobile Job Cards */}
                      <SimpleGrid cols={1} spacing="md">
                        {sortJobs(filteredJobs, sortOption).map((job) => {
                          const jobId = getJobId(job);
                          return (
                            <JobCard
                              key={jobId}
                              job={job}
                              jobId={jobId}
                              isSelected={selectedJobs.has(jobId)}
                              onSelectionChange={handleMobileSelectionChange}
                            />
                          );
                        })}
                      </SimpleGrid>
                    </Stack>
                  ) : (
                    <JobTable 
                      jobs={filteredJobs} 
                      onSelectionChange={handleSelectionChange}
                      onSelectedJobsChange={handleSelectedJobsChange}
                    />
                  )}
                </>
              )}
            </Stack>
          )}
        </Stack>
      </Container>
      
      {/* Auth Modal */}
      <AuthModal 
        opened={authModalOpened} 
        onClose={() => setAuthModalOpened(false)}
        hasSearchResults={jobs.length > 0}
      />
      
      {/* Auth Modal for Actions (with custom text) */}
      <AuthModal 
        opened={authModalForAction} 
        onClose={() => setAuthModalForAction(false)}
        customTitle="Sign in to proceed"
        customMessage="Please sign in to organize and track your job applications."
      />
    </>
  );
}