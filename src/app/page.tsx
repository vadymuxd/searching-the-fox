'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import {
  Container,
  Stack,
  Text,
  Paper,
  Alert,
  Box,
  Group,
  SimpleGrid,  
} from '@mantine/core';
import { useMantineTheme } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconInfoCircle, IconAlertCircle, IconCheck, IconMail } from '@tabler/icons-react';
import { SearchForm } from '@/components/SearchForm';
import { JobTable } from '@/components/JobTable';
import { JobCard } from '@/components/JobCard';
import { PageFilter } from '@/components/PageFilter';
import { SortDropdown, SortOption } from '@/components/SortDropdown';
import { Timer } from '@/components/Timer';
import { LoadingInsightWithIcon as LoadingInsight } from '@/components/LoadingInsight';
import { AuthModal } from '@/components/AuthModal';
import { AuthButton } from '@/components/AuthButton';
import { Header } from '@/components/Header';
import { JobService } from '@/lib/api';
import { searchStorage } from '@/lib/localStorage';
import { saveJobsToDatabase, getUserJobs } from '@/lib/db/jobService';
import { getUserPreferences, saveLastSearch } from '@/lib/db/userPreferences';
import { createClient } from '@/lib/supabase/client';
import { Job, SearchFormData, JobSearchResponse } from '@/types/job';
import { useAuth } from '@/lib/auth/AuthContext';
import type { User } from '@supabase/supabase-js';

export default function HomePage() {
  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);
  const { user } = useAuth(); // Use the AuthContext instead of local user state
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchStarted, setSearchStarted] = useState(false);
  const [currentSearch, setCurrentSearch] = useState<SearchFormData | null>(null);
  const [selectedJobsCount, setSelectedJobsCount] = useState(0);
  const [totalSelectedJobs, setTotalSelectedJobs] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [sortOption, setSortOption] = useState<SortOption>('posted-recent');
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());
  const [progressInfo, setProgressInfo] = useState<{
    currentSite: string;
    completed: number;
    total: number;
  } | undefined>(undefined);
  const [authModalOpened, setAuthModalOpened] = useState(false);
  const [loadingUserJobs, setLoadingUserJobs] = useState(false);
  const [emailNotConfirmed, setEmailNotConfirmed] = useState(false);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);
  
  // Track if we've already loaded data for this user to prevent re-loading on tab focus
  const userDataLoadedRef = useRef<string | null>(null);

  // Memoized callback for filtered jobs change to prevent PageFilter reloads
  const handleFilteredJobsChange = useCallback((filteredJobs: Job[]) => {
    setFilteredJobs(filteredJobs);
  }, []);

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
      setSearchStarted(false);
      
      loadUserJobsFromDb(user.id);
      loadUserPreferencesFromDb(user.id);
    } else {
      // Reset the ref when user logs out
      userDataLoadedRef.current = null;
    }
  }, [user, mounted]); // Add mounted as dependency

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

  // Reset application to pre-search state
  const resetToPreSearchState = () => {
    setJobs([]);
    setFilteredJobs([]);
    setSearchStarted(false);
    setCurrentSearch(null);
    setSelectedJobs(new Set());
    setSelectedJobsCount(0);
    setTotalSelectedJobs(0);
    setError(null);
    setSortOption('posted-recent');
    // Clear localStorage as well
    searchStorage.clearSearchData();
  };

  // Load user jobs from database
  const loadUserJobsFromDb = async (userId: string) => {
    setLoadingUserJobs(true);
    try {
      // First, clear any existing data to ensure clean state for authenticated users
      setJobs([]);
      setFilteredJobs([]);
      
      const result = await getUserJobs(userId);
      if (result.success) {
        // Always show search results view for authenticated users, even if no jobs
        setJobs(result.jobs);
        setFilteredJobs(result.jobs);
        setSearchStarted(true); // Always true for authenticated users to show results view
      } else {
        // Even on error, show the results view (empty state) for authenticated users
        setJobs([]);
        setFilteredJobs([]);
        setSearchStarted(true);
      }
    } catch (error) {
      console.error('Error loading user jobs:', error);
      // Even on error, show the results view (empty state) for authenticated users
      setJobs([]);
      setFilteredJobs([]);
      setSearchStarted(true);
    } finally {
      setLoadingUserJobs(false);
    }
  };

  // Auto-save to DB after successful search for authenticated users
  const autoSaveToDb = async (newJobs: Job[], userId: string) => {
    try {
      const result = await saveJobsToDatabase(newJobs, userId);
      if (result.success) {
        console.log(`Auto-saved ${result.jobsSaved} jobs to database`);
        // Reload jobs from DB to get the updated list with user_jobs metadata
        await loadUserJobsFromDb(userId);
      }
    } catch (error) {
      console.error('Error auto-saving to database:', error);
    }
  };

  // Load saved data on component mount
  useEffect(() => {
    setMounted(true);
    
    // ONLY load from localStorage if user is NOT signed in
    // Authenticated users get their data EXCLUSIVELY from database via loadUserJobsFromDb()
    if (!user) {
      const savedResults = searchStorage.loadSearchResults();
      if (savedResults) {
        setJobs(savedResults.jobs);
        setFilteredJobs(savedResults.jobs);
        setSearchStarted(savedResults.searchStarted);
        setCurrentSearch(savedResults.searchData);
      } else {
        // If no results, still try to load just the search form data
        const savedSearchData = searchStorage.loadSearchData();
        if (savedSearchData) {
          setCurrentSearch(savedSearchData);
        }
      }
    } else {
      // For authenticated users: ensure clean state, data comes ONLY from database
      console.log('User is authenticated - skipping localStorage, using database only');
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
    
    // Selection state is only kept in memory during session (no localStorage)
    
    // Update counts
    setSelectedJobsCount(newSelected.size);
    setTotalSelectedJobs(newSelected.size);
  };

  const handleReset = () => {
    if (user) {
      // For authenticated users: Reset to pre-search state, data comes from database
      setJobs([]);
      setFilteredJobs([]);
      setSearchStarted(false);
      setError(null);
      setLoading(false);
      setSelectedJobsCount(0);
      setTotalSelectedJobs(0);
      setProgressInfo(undefined);
      // Don't touch localStorage for authenticated users
    } else {
      // For anonymous users: Clear localStorage and reset state
      searchStorage.clearResultsOnly();
      
      // Reset only state related to results, keep search form data
      setJobs([]);
      setFilteredJobs([]);
      setSearchStarted(false);
      setError(null);
      setLoading(false);
      setSelectedJobsCount(0);
      setTotalSelectedJobs(0);
      setProgressInfo(undefined);
      
      // Reload search form data from localStorage to ensure it's preserved
      const savedSearchData = searchStorage.loadSearchData();
      if (savedSearchData) {
        setCurrentSearch(savedSearchData);
      } else {
        setCurrentSearch(null);
      }
    }
  };

  const handleSelectionChange = (selectedCount: number) => {
    setSelectedJobsCount(selectedCount);
    setTotalSelectedJobs(selectedCount);
  };

  const handleSearch = async (searchData: SearchFormData) => {
    // If user is authenticated and has localStorage data, migrate it first
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
    
    // Clear previous search data when starting a new search
    searchStorage.clearSearchData();
    
    setLoading(true);
    setError(null);
    setSearchStarted(true);
    setCurrentSearch(searchData); // Store the current search data
    setJobs([]);
    setFilteredJobs([]);
    setSelectedJobsCount(0); // Reset selected jobs count
    setTotalSelectedJobs(0); // Reset total selected jobs count
    setProgressInfo(undefined); // Reset progress info

    // Save search data to localStorage (for non-authenticated users)
    if (!user) {
      searchStorage.saveSearchData(searchData);
    }

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
        setJobs(response.jobs);
        setFilteredJobs(response.jobs); // Initialize filtered jobs with all jobs
        
        // Save to localStorage ONLY for anonymous users
        if (!user) {
          searchStorage.saveSearchResults({
            jobs: response.jobs,
            searchStarted: true,
            searchData: searchData,
          });
        }
        
        // Auto-save to database if user is authenticated
        if (user) {
          await autoSaveToDb(response.jobs, user.id);
        }
        
        // Show success notification only after completion
        notifications.show({
          title: 'Search completed!',
          message: `Found ${response.jobs.length} jobs${searchData.site === 'all' ? ' across all job boards' : ''}${user ? ' and saved to your account' : ''}`,
          icon: <IconCheck size={16} />,
          color: 'green',
          autoClose: 3000,
        });
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
      setProgressInfo(undefined); // Clear progress info when done
    }
  };

  return (
    <>
      {/* Header with Logo and Auth Button */}
      <Header onSignInClick={() => setAuthModalOpened(true)} />
      
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
                  We've sent a confirmation email to {unconfirmedEmail ? <strong>{unconfirmedEmail}</strong> : 'your inbox'}. Please check your email and click the confirmation link to activate your account.
                </Text>
                <Text size="sm" c="dimmed">
                  Don't see the email? Check your spam folder or contact support if you need help.
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
      ) : !searchStarted ? (
        // Centered layout for initial state
        <Box style={{ backgroundColor: '#f8f9fa', minHeight: '100vh', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                <Image 
                  src="/Glassdoor.svg" 
                  alt="Glassdoor" 
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
          </Box>
        </Box>
      ) : (
        // Split layout after search is started
        <>
          {/* Top Section - Search Form */}
          <Box 
            style={{ 
              backgroundColor: '#f8f9fa',
              borderBottom: '1px solid #dee2e6',
              padding: '24px 0'
            }}
          >
            <Container size="xl">
              <SearchForm 
                onSearch={handleSearch} 
                onReset={handleReset}
                loading={loading}
                initialValues={currentSearch || undefined}
                showLogo={false}
              />
            </Container>
          </Box>

          {/* Bottom Section - Results */}
          <Container size="xl" py="xl">
            <Stack gap="xl">
              {/* Loading Progress */}
              {loading && (
                <Paper p="md" radius="md">
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
              )}

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
              {searchStarted && !loading && jobs.length === 0 && !error && (
                <Alert 
                  icon={<IconInfoCircle size={16} />} 
                  title="No Jobs Found" 
                  color="blue"
                  variant="light"
                  styles={{
                    message: { fontSize: '14px' }
                  }}
                >
                  No jobs were found matching your criteria. Try adjusting your search terms or expanding your location.
                </Alert>
              )}

              {jobs.length > 0 && (
                <Stack gap="lg">
                  {/* Job Counter */}
                  <Group justify="space-between" align="center">
                    <Text fw={600} size="sm">
                      {filteredJobs.length} of {jobs.length} jobs shown
                    </Text>
                    {totalSelectedJobs > 0 && (
                      <Text fw={500} size="sm" c="blue">
                        {selectedJobsCount > 0 && selectedJobsCount !== totalSelectedJobs
                          ? `${selectedJobsCount} of ${totalSelectedJobs} selected job${totalSelectedJobs !== 1 ? 's' : ''} visible`
                          : `${totalSelectedJobs} job${totalSelectedJobs !== 1 ? 's' : ''} selected`
                        }
                      </Text>
                    )}
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
                        />
                      )}
                    </>
                  )}
                </Stack>
              )}
            </Stack>
          </Container>
        </>
      )}
      
      {/* Auth Modal */}
      <AuthModal 
        opened={authModalOpened} 
        onClose={() => setAuthModalOpened(false)}
        hasSearchResults={searchStarted && jobs.length > 0}
      />
    </>
  );
}
