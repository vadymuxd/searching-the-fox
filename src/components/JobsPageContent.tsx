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
import { IconInfoCircle, IconAlertCircle, IconRefresh, IconEdit, IconSquareCheck, IconSquare } from '@tabler/icons-react';
import { TextButton } from '@/components/TextButton';
import { JobTable } from '@/components/JobTable';
import { JobCard } from '@/components/JobCard';
import { PageFilter } from '@/components/PageFilter';
import { SortDropdown, SortOption } from '@/components/SortDropdown';
import { AuthModal } from '@/components/AuthModal';
import { Header } from '@/components/Header';
import { TabNavigation } from '@/components/TabNavigation';
import { MoveToButton } from '@/components/MoveToButton';
import { CubePreloader } from '@/components/CubePreloader';
import { searchStorage } from '@/lib/localStorage';
import { getUserJobs } from '@/lib/db/jobService';
import { getUserPreferences, saveLastSearch } from '@/lib/db/userPreferences';
import { Job, SearchFormData } from '@/types/job';
import { useAuth } from '@/lib/auth/AuthContext';
import { SITE_OPTIONS } from '@/lib/api';

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
  const [isNavigatingTab, setIsNavigatingTab] = useState(false); // Track tab navigation state
  // Strict loading gates
  const [jobsLoaded, setJobsLoaded] = useState(false);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [pageFilterReady, setPageFilterReady] = useState(false);
  const [allLoaded, setAllLoaded] = useState(false);
  
  // Track if we've already loaded data for this user to prevent re-loading on tab focus
  const userDataLoadedRef = useRef<string | null>(null);
  const currentStatusRef = useRef<string | undefined>(status);

  // Monitor status changes for tab navigation loading
  useEffect(() => {
    if (currentStatusRef.current !== status) {
      setIsNavigatingTab(true);
      // Reset gates for tab change
      setJobsLoaded(false);
      setPreferencesLoaded(false);
      setPageFilterReady(false);
      setAllLoaded(false);
      currentStatusRef.current = status;
    }
  }, [status]);

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
        // Hide navigation loading after successful load
        setIsNavigatingTab(false);
        setJobsLoaded(true);
      } else {
        setJobs([]);
        setFilteredJobs([]);
        setError('Failed to load jobs from database');
        setIsNavigatingTab(false);
        setJobsLoaded(true); // consider jobs phase complete even on error to avoid deadlock
      }
    } catch (error) {
      console.error('Error loading user jobs:', error);
      setJobs([]);
      setFilteredJobs([]);
      setError('Failed to load jobs from database');
      setIsNavigatingTab(false);
      setJobsLoaded(true);
    }
  }, [status]);

  // React to user changes from AuthContext
  useEffect(() => {
    // Skip if this is the initial mount and we haven't finished loading
    if (!mounted || authLoading) return;
    
    console.log('User changed from AuthContext:', user);
    
    // Reset loading gates when starting to load new data
    setJobsLoaded(false);
    setPreferencesLoaded(false);
    setPageFilterReady(false);
    setAllLoaded(false);
    
    // Set loading state when tab navigation starts
    setIsNavigatingTab(true);
    
    // If user is signed in, load their data
    if (user) {
      // Check if we've already loaded data for this user
      if (userDataLoadedRef.current === user.id) {
        console.log('User data already loaded, skipping reload');
        setIsNavigatingTab(false);
        // Even if we skip reload, mark gates as satisfied for jobs/preferences
        setJobsLoaded(true);
        setPreferencesLoaded(true);
        return;
      }
      
      console.log('User authenticated - loading user data');
      userDataLoadedRef.current = user.id;
      
      // Clear any localStorage data immediately for authenticated users
      setJobs([]);
      setFilteredJobs([]);
      
      loadUserJobsFromDb(user.id);
      loadUserPreferencesFromDb(user.id).finally(() => setPreferencesLoaded(true));
    } else {
      // Reset the ref when user logs out or for guest users
      userDataLoadedRef.current = null;
      // For guest users, load from localStorage
      if (!user) {
        loadGuestData(); // will set both jobs and preferences gates
        setIsNavigatingTab(false);
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
    // Gates for guest users
    setJobsLoaded(true);
    setPreferencesLoaded(true);
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

  // Compute when everything is loaded
  useEffect(() => {
    // If there are no jobs, we don't wait for PageFilter readiness
    const filterGate = filteredJobs.length === 0 ? true : pageFilterReady;
    const ready = !authLoading && mounted && jobsLoaded && preferencesLoaded && filterGate && !isNavigatingTab;
    setAllLoaded(ready);
  }, [authLoading, mounted, jobsLoaded, preferencesLoaded, pageFilterReady, isNavigatingTab, filteredJobs.length]);

  // Handler to mark PageFilter readiness
  const handlePageFilterReady = useCallback(() => {
    setPageFilterReady(true);
  }, []);

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
  // We always render header and tabs; content area gets an overlay until allLoaded

  return (
    <>
      {/* Header with Logo and Auth Button */}
      <Header onSignInClick={() => setAuthModalOpened(true)} />
      
      {/* Tab Navigation - for all users */}
      <TabNavigation onAuthRequired={handleAuthRequired} backgroundColor="#fff" />

  {/* Content area wrapper to control overlay layering */}
  <Box style={{ position: 'relative' }}>
        {/* Loading Overlay - covers only the content area below tabs */}
        {(!allLoaded) && (
          <Box
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: '#ffffff',
              zIndex: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '40vh'
            }}
          >
            <CubePreloader isLoaded={allLoaded} />
          </Box>
        )}

        {/* Top Section - Search Summary - only show for "new" status */}
      {status === 'new' && (
        <Box 
          style={{ 
            backgroundColor: '#fff',
            padding: '24px 0'
          }}
        >
          <Container size="xl">
            {currentSearch ? (
              <Stack gap="md">
                {/* Search Summary */}
                <Text size="sm" fw={400}>
                  Jobs for <strong>{currentSearch.jobTitle}</strong> in <strong>{currentSearch.location}</strong> from <strong>{getJobBoardName(currentSearch.site)}</strong> posted within <strong>{getTimePeriod(currentSearch.hoursOld)}</strong>
                </Text>
                {/* Action Buttons */}
                <Group gap={32}>
                  <TextButton
                    leftSection={<IconRefresh size={16} />}
                    onClick={handleRefresh}
                    size="sm"
                  >
                    Search new jobs
                  </TextButton>
                  <TextButton
                    leftSection={<IconEdit size={16} />}
                    onClick={handleEditSearch}
                    size="sm"
                  >
                    Edit search
                  </TextButton>
                </Group>
              </Stack>
            ) : (
              <Text size="lg" c="dimmed">
                You didn&apos;t perform any search yet
              </Text>
            )}
            {/* Bottom border separator, limited to content width */}
            <div style={{ borderBottom: '1px solid #dee2e6', marginTop: 24 }} />
          </Container>
        </Box>
      )}

      {/* Bottom Section - Results */}
      <Container
        size="xl"
        py={isMobile ? undefined : 'xl'}
        style={isMobile ? { paddingTop: 0, paddingBottom: 'var(--mantine-spacing-xl)' } : undefined}
      >
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
            <Box style={{ display: 'flex', justifyContent: 'center', padding: '2rem 0' }}>
              {status === 'new' ? (
                <Button
                  leftSection={<IconRefresh size={16} />}
                  onClick={handleRefresh}
                  size="md"
                >
                  Search new jobs
                </Button>
              ) : (
                <Text size="sm" c="dimmed">There are no jobs added to this category</Text>
              )}
            </Box>
          )}

          {jobs.length > 0 && (
            <Stack gap="lg">
              {/* Job Counter */}
              <Group justify="space-between" align="center">
                <Text fw={600} size="sm">
                  {filteredJobs.length} of {jobs.length} jobs shown
                </Text>
                {/* On desktop, do not show selected count and MoveToButton here; on mobile, they're shown in the row with Select all */}
                {!isMobile && (
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
                )}
              </Group>

              {/* Page Filter */}
              <PageFilter 
                jobs={jobs} 
                onFilteredJobsChange={handleFilteredJobsChange}
                onReady={handlePageFilterReady}
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
                      {/* Select All, Selected Count, and MoveToButton in a row */}
                      {filteredJobs.length > 0 && (
                        <Group gap="sm" align="center" wrap="nowrap" style={{ width: '100%' }}>
                          <TextButton
                            size="sm"
                            onClick={() => {
                              const allIds = sortJobs(filteredJobs, sortOption).map(getJobId);
                              const allSelected = allIds.every(id => selectedJobs.has(id));
                              if (allSelected) {
                                // Deselect all
                                setSelectedJobs(new Set());
                                setSelectedJobsCount(0);
                                setTotalSelectedJobs(0);
                                setSelectedJobsData([]);
                              } else {
                                // Select all
                                setSelectedJobs(new Set(allIds));
                                setSelectedJobsCount(allIds.length);
                                setTotalSelectedJobs(allIds.length);
                                setSelectedJobsData(
                                  sortJobs(filteredJobs, sortOption).map(job => ({
                                    userJobId: job.user_job_id || '',
                                    title: job.title,
                                    company: job.company,
                                    jobId: getJobId(job),
                                  }))
                                );
                              }
                            }}
                            style={{ width: 'fit-content' }}
                            leftSection={(() => {
                              const allIds = sortJobs(filteredJobs, sortOption).map(getJobId);
                              const allSelected = allIds.length > 0 && allIds.every(id => selectedJobs.has(id));
                              return allSelected ? <IconSquareCheck size={16} /> : <IconSquare size={16} />;
                            })()}
                          >
                            {(() => {
                              const allIds = sortJobs(filteredJobs, sortOption).map(getJobId);
                              const allSelected = allIds.length > 0 && allIds.every(id => selectedJobs.has(id));
                              return allSelected ? 'Deselect all' : 'Select all';
                            })()}
                          </TextButton>
                          <div style={{ flex: 1 }} />
                          {totalSelectedJobs > 0 && (
                            <Text fw={500} size="sm" c="blue" style={{ whiteSpace: 'nowrap' }}>
                              {selectedJobsCount > 0 && selectedJobsCount !== totalSelectedJobs
                                ? `${selectedJobsCount} of ${totalSelectedJobs} selected`
                                : `${totalSelectedJobs} selected`}
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
                      )}
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

  </Box>
      
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