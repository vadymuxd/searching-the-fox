'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  Container,
  Stack,
  Title,
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
import { IconInfoCircle, IconAlertCircle, IconCheck } from '@tabler/icons-react';
import { SearchForm } from '@/components/SearchForm';
import { JobTable } from '@/components/JobTable';
import { JobCard } from '@/components/JobCard';
import { PageFilter } from '@/components/PageFilter';
import { SortDropdown, SortOption } from '@/components/SortDropdown';
import { Timer } from '@/components/Timer';
import { LoadingInsightWithIcon as LoadingInsight } from '@/components/LoadingInsight';
import { JobService } from '@/lib/api';
import { searchStorage } from '@/lib/localStorage';
import { Job, SearchFormData, JobSearchResponse } from '@/types/job';

export default function HomePage() {
  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);
  
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

  // Load saved data on component mount
  useEffect(() => {
    setMounted(true);
    
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
    
    // Load saved selected jobs count and individual selections
    const savedSelectedJobs = searchStorage.loadSelectedJobs();
    setTotalSelectedJobs(savedSelectedJobs.length);
    setSelectedJobs(new Set(savedSelectedJobs));
  }, []);

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
    
    // Save to localStorage
    searchStorage.saveSelectedJobs(Array.from(newSelected));
    
    // Update counts
    setSelectedJobsCount(newSelected.size);
    setTotalSelectedJobs(newSelected.size);
  };

  const handleReset = () => {
    // Clear only results but preserve search form data
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
  };

  const handleSelectionChange = (selectedCount: number) => {
    setSelectedJobsCount(selectedCount);
    // Load total selected jobs from localStorage to show complete count
    const allSelected = searchStorage.loadSelectedJobs();
    setTotalSelectedJobs(allSelected.length);
  };

  const handleSearch = async (searchData: SearchFormData) => {
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

    // Save search data to localStorage
    searchStorage.saveSearchData(searchData);

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
        
        // Save search results to localStorage
        searchStorage.saveSearchResults({
          jobs: response.jobs,
          searchStarted: true,
          searchData: searchData,
        });
        
        // Show success notification only after completion
        notifications.show({
          title: 'Search completed!',
          message: `Found ${response.jobs.length} jobs${searchData.site === 'all' ? ' across all job boards' : ''}`,
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
      {!mounted ? (
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
                    onFilteredJobsChange={setFilteredJobs}
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
    </>
  );
}
