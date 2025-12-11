'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
  Loader,
} from '@mantine/core';
import { useMantineTheme } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconInfoCircle, IconRefresh, IconEdit, IconSquareCheck, IconSquare } from '@tabler/icons-react';
import { TextButton } from '@/components/TextButton';
import { JobTable } from '@/components/JobTable';
import { JobCard } from '@/components/JobCard';
import { PageFilter } from '@/components/PageFilter';
import { SortDropdown, SortOption } from '@/components/SortDropdown';
import { AuthModal } from '@/components/AuthModal';
import { Header } from '@/components/Header';
import { TabNavigation } from '@/components/TabNavigation';
import { MoveToButton } from '@/components/MoveToButton';
import { JobOperationManager } from '@/components/JobOperationManager';
import { searchStorage } from '@/lib/localStorage';
import { Job, SearchFormData } from '@/types/job';
import { useAuth } from '@/lib/auth/AuthContext';
import { SITE_OPTIONS } from '@/lib/api';
import { jobsDataManager } from '@/lib/jobsDataManager';
// Note: Avoid showing bot icon during loading to reduce visual clutter

interface JobsPageContentProps {
  status?: 'new' | 'interested' | 'applied' | 'progressed' | 'rejected' | 'archived';
  onTabChange?: (newStatus: 'new' | 'interested' | 'applied' | 'progressed' | 'rejected' | 'archived') => void;
}

export default function JobsPageContent({ status, onTabChange }: JobsPageContentProps) {
  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<Job[]>([]);
  const [currentSearch, setCurrentSearch] = useState<SearchFormData | null>(null);
  const [selectedJobsCount, setSelectedJobsCount] = useState(0);
  const [totalSelectedJobs, setTotalSelectedJobs] = useState(0);
  const [sortOption, setSortOption] = useState<SortOption>('posted-recent');
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());
  const [selectedJobsData, setSelectedJobsData] = useState<Array<{ userJobId: string; title: string; company: string; jobId: string }>>([]);
  const [authModalOpened, setAuthModalOpened] = useState(false);
  const [authModalForAction, setAuthModalForAction] = useState(false);
  const [searchDataLoading, setSearchDataLoading] = useState(true);
  const [isFiltered, setIsFiltered] = useState(false);
  const [clearSelectionsKey, setClearSelectionsKey] = useState(0); // Key to trigger clearing selections

  // Memoized callback for filtered jobs change to prevent PageFilter reloads
  const handleFilteredJobsChange = useCallback((filteredJobs: Job[]) => {
    setFilteredJobs(filteredJobs);
  }, []);
  
  // Callback to receive filter state from PageFilter
  const handleFilterStateChange = useCallback((filtered: boolean) => {
    setIsFiltered(filtered);
  }, []);



  // Track latest status to avoid stale closures when async operations finish after tab switches
  const currentStatusRef = useRef(status);
  useEffect(() => { currentStatusRef.current = status; }, [status]);

  // Load user jobs with cache-first strategy for a specific status
  const loadUserJobsFromCache = useCallback(async (userId: string, statusParam: string | undefined, forceSync = false) => {
    try {
      let result;
      if (forceSync) {
        result = await jobsDataManager.syncWithDatabase(userId, statusParam, true);
      } else {
        result = await jobsDataManager.getJobsForUser(userId, statusParam);
      }

      if (result.success) {
        setJobs(result.jobs);
        const searchData = jobsDataManager.getCachedSearchData(userId);
        if (searchData) setCurrentSearch(searchData);
      } else {
        setJobs([]);
      }
    } catch (error) {
      console.error('Error loading user jobs:', error);
      setJobs([]);
    }
  }, []);

  // Stable refresh function referencing latest status via ref
  const refreshJobs = useCallback(async (force = false) => {
    if (user) {
      await loadUserJobsFromCache(user.id, currentStatusRef.current, force);
    } else {
      loadGuestData();
    }
  }, [user, loadUserJobsFromCache]);

  const loadData = useCallback(async () => {
    setSearchDataLoading(true);
    // Clear current jobs so tab switch feels instant and we can show a loader
    setJobs([]);
    setFilteredJobs([]);
    
    if (user) {
      await loadUserJobsFromCache(user.id, currentStatusRef.current);

      const cachedSearch = jobsDataManager.getCachedSearchData(user.id);
      const cacheIsFresh = jobsDataManager.hasFreshPreferences(user.id);

      if (!cachedSearch || !cacheIsFresh) {
        await loadUserPreferences(user.id, !cacheIsFresh);
      }
    } else {
      loadGuestData();
    }
    
    setSearchDataLoading(false);
  }, [user, loadUserJobsFromCache]);

  // React to auth/status changes by (re)loading data
  useEffect(() => {
    if (authLoading) {
      setSearchDataLoading(true);
      return;
    }
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, status]);

  // Load guest data from localStorage
  const loadGuestData = () => {
    const result = jobsDataManager.getJobsForGuest();
    if (result.success) {
      setJobs(result.jobs);
      // Don't set filteredJobs here - let PageFilter handle it through onFilteredJobsChange
      setCurrentSearch(result.searchData);
    } else {
      setJobs([]);
      // Don't set filteredJobs here - let PageFilter handle it through onFilteredJobsChange
      setCurrentSearch(null);
    }
  };

  // Load user preferences from database
  const loadUserPreferences = async (userId: string, force = false) => {
    try {
      const result = await jobsDataManager.getUserPreferences(userId, force);
      if (result.success && result.preferences?.lastSearch) {
        setCurrentSearch(result.preferences.lastSearch);
      }
    } catch (error) {
      console.error('Error loading user preferences:', error);
    }
  };

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
  await jobsDataManager.saveLastSearch(user.id, currentSearch);
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

  const handleRefresh = async () => {
    // Initiate search directly from results page without page reload
    // Create search_run, send API request, then trigger SearchRunning to appear
    if (!currentSearch) return;
    
    try {
      console.log('[handleRefresh] Creating search run and initiating search...');
      
      // Import needed services
      const { createClient } = await import('@/lib/supabase/client');
      const { createSearchRun } = await import('@/lib/db/searchRunService');
      
      if (!user?.id) {
        console.error('[handleRefresh] No user ID - cannot create search run');
        return;
      }
      
      // Create the search_run in database first (status: "pending")
      const supabase = createClient();
      const searchRun = await createSearchRun(
        {
          userId: user.id,
          parameters: {
            jobTitle: currentSearch.jobTitle,
            location: currentSearch.location,
            site: currentSearch.site,
            hours_old: parseInt(currentSearch.hoursOld || '24'),
            results_wanted: currentSearch.resultsWanted || 1000,
          },
          source: 'manual',
          clientContext: {
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
            timestamp: new Date().toISOString(),
          },
        },
        supabase
      );
      
      if (!searchRun) {
        console.error('[handleRefresh] Failed to create search run');
        return;
      }
      
      console.log('[handleRefresh] Search run created:', searchRun.id);
      
      // Now make the API call with the search_run ID
      // Use keepalive to ensure request completes even if user navigates away
      const endpoint = '/api/proxy-scrape';
      const requestBody = {
        search_term: currentSearch.jobTitle,
        location: currentSearch.location,
        site_name: currentSearch.site === 'all' 
          ? ['linkedin', 'indeed']
          : [currentSearch.site],
        results_wanted: currentSearch.resultsWanted || 1000,
        hours_old: parseInt(currentSearch.hoursOld || '24'),
        country_indeed: 'UK',
        run_id: searchRun.id,
        user_id: user.id,
      };
      
      // Send request with keepalive (continues even if user closes tab)
      console.log('[handleRefresh] Sending API request to:', endpoint, 'with body:', requestBody);
      fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        keepalive: true,
      })
        .then(response => {
          console.log('[handleRefresh] API response received, status:', response.status);
          return response.json();
        })
        .then(data => {
          console.log('[handleRefresh] API response data:', data);
        })
        .catch(error => {
          console.error('[handleRefresh] Fetch error:', error);
        });
      
      console.log('[handleRefresh] API request initiated, triggering SearchRunning component...');
      
      // Trigger SearchRunning component to appear by calling refreshStatus
      // This is exposed globally by GlobalSearchMonitor
      if (typeof window !== 'undefined') {
        const globalWindow = window as { __searchStatus_refresh?: () => Promise<void> };
        if (globalWindow.__searchStatus_refresh) {
          globalWindow.__searchStatus_refresh();
          console.log('[handleRefresh] SearchRunning component triggered');
        } else {
          console.warn('[handleRefresh] refreshStatus not available, SearchRunning may not appear immediately');
        }
      }
      
      // No page reload needed - SearchRunning will appear and poll database
      // User stays in context on results page
      
    } catch (error) {
      console.error('[handleRefresh] Error initiating search:', error);
    }
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

  const handleStatusUpdate = useCallback(async () => {
    // Force sync using latest status (not the status captured when operation started)
    if (user) {
      await loadUserJobsFromCache(user.id, currentStatusRef.current, true);
    }
  }, [user, loadUserJobsFromCache]);

  // Listen for cache update events (jobsCacheUpdated dispatched by jobsDataManager) and legacy jobsUpdated
  useEffect(() => {
    if (typeof window === 'undefined' || !user) return;
    const handler = () => { refreshJobs(false); };
    window.addEventListener('jobsCacheUpdated', handler as EventListener);
    window.addEventListener('jobsUpdated', handler as EventListener);
    return () => {
      window.removeEventListener('jobsCacheUpdated', handler as EventListener);
      window.removeEventListener('jobsUpdated', handler as EventListener);
    };
  }, [user, refreshJobs]);

  // Handler to clear selections after jobs are moved
  const handleJobsMoved = useCallback(() => {
    setSelectedJobs(new Set());
    setSelectedJobsCount(0);
    setTotalSelectedJobs(0);
    setSelectedJobsData([]);
    setClearSelectionsKey(prev => prev + 1); // Increment to trigger JobTable clear
  }, []);

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

  return (
    <>
      {/* Job Operation Manager - handles resuming interrupted operations */}
      <JobOperationManager onOperationComplete={handleStatusUpdate} />
      
      {/* Header with Logo and Auth Button */}
      <div style={{ position: 'relative', zIndex: 20 }}>
        <Header onSignInClick={() => setAuthModalOpened(true)} />
      </div>
      {/* Tab Navigation - for all users */}
      <div style={{ marginBottom: isMobile ? 0 : 24, position: 'relative', zIndex: 20 }}>
        <TabNavigation onAuthRequired={handleAuthRequired} onTabChange={onTabChange} backgroundColor="#fff" />
      </div>

  {/* Content area wrapper (below header/tabs) */}
  <Box style={{ position: 'relative', minHeight: '60vh' }}>
        {/* Main content is always rendered; loading overlay will cover it to prevent flicker */}
        <>
            {/* Top Section - Search Summary - only show for "new" status */}
            {status === 'new' && (
              <Box 
                style={{ 
                  backgroundColor: '#fff',
                  padding: '0 0 24px 0'
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
                    // Only show empty state after verifying no data
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
                {/* Results */}
                {searchDataLoading ? (
                  <Box
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minHeight: '60vh',
                    }}
                  >
                    <Loader color="dark" size="md" />
                  </Box>
                ) : jobs.length === 0 ? (
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
                ) : (
                  <Stack gap="lg">
                    {/* Job Counter */}
                    <Group justify="space-between" align="center">
                      <Text fw={600} size="sm">
                        {isFiltered 
                          ? `${filteredJobs.length} jobs filtered by keywords`
                          : 'Filter by job titles'
                        }
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
                              onJobsMoved={handleJobsMoved}
                            />
                          )}
                        </Group>
                      )}
                    </Group>

                    {/* Page Filter */}
                    <PageFilter 
                      jobs={jobs} 
                      status={status}
                      onFilteredJobsChange={handleFilteredJobsChange}
                      onFilterStateChange={handleFilterStateChange}
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
                                    onJobsMoved={handleJobsMoved}
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
                            clearSelections={clearSelectionsKey}
                          />
                        )}
                      </>
                    )}
                  </Stack>
                )}
              </Stack>
            </Container>
      </>

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