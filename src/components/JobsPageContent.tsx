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
import { searchStorage } from '@/lib/localStorage';
import { Job, SearchFormData } from '@/types/job';
import { useAuth } from '@/lib/auth/AuthContext';
import { SITE_OPTIONS } from '@/lib/api';
import { jobsDataManager } from '@/lib/jobsDataManager';

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

  // Memoized callback for filtered jobs change to prevent PageFilter reloads
  const handleFilteredJobsChange = useCallback((filteredJobs: Job[]) => {
    setFilteredJobs(filteredJobs);
  }, []);
  
  // Callback to receive filter state from PageFilter
  const handleFilterStateChange = useCallback((filtered: boolean) => {
    setIsFiltered(filtered);
  }, []);



  // Load user jobs with cache-first strategy
  const loadUserJobsFromCache = useCallback(async (userId: string, forceSync = false) => {
    try {
      
      let result;
      if (forceSync) {
        // Force sync with database
        result = await jobsDataManager.syncWithDatabase(userId, status, true);
      } else {
        // Cache-first strategy
        result = await jobsDataManager.getJobsForUser(userId, status);
      }
      
      if (result.success) {
        setJobs(result.jobs);
        setFilteredJobs(result.jobs);
        
        // Load search data for authenticated users
        const searchData = jobsDataManager.getCachedSearchData(userId);
        if (searchData) {
          setCurrentSearch(searchData);
        }
      } else {
        setJobs([]);
        setFilteredJobs([]);
      }
    } catch (error) {
      console.error('Error loading user jobs:', error);
      setJobs([]);
      setFilteredJobs([]);
    }
  }, [status]);

  const loadData = useCallback(async () => {
    setSearchDataLoading(true);
    
    if (user) {
      await loadUserJobsFromCache(user.id);

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
      setFilteredJobs(result.jobs);
      setCurrentSearch(result.searchData);
    } else {
      setJobs([]);
      setFilteredJobs([]);
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

  const handleStatusUpdate = useCallback(async () => {
    router.refresh();
    if (user) {
      await loadUserJobsFromCache(user.id, true); // Force sync after status update
    }
  }, [router, user, loadUserJobsFromCache]);

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
      {/* Header with Logo and Auth Button */}
      <Header onSignInClick={() => setAuthModalOpened(true)} />
      {/* Tab Navigation - for all users */}
      <div style={{ marginBottom: isMobile ? 0 : 24 }}>
        <TabNavigation onAuthRequired={handleAuthRequired} onTabChange={onTabChange} backgroundColor="#fff" />
      </div>

  {/* Content area wrapper (below header/tabs) */}
  <Box style={{ position: 'relative', minHeight: '60vh' }}>
        {/* Content */}
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
                {jobs.length === 0 ? (
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
                            />
                          )}
                        </Group>
                      )}
                    </Group>

                    {/* Page Filter */}
                    <PageFilter 
                      jobs={jobs} 
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