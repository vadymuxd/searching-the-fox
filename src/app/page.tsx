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
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconInfoCircle, IconAlertCircle, IconCheck } from '@tabler/icons-react';
import { SearchForm } from '@/components/SearchForm';
import { JobTable } from '@/components/JobTable';
import { PageFilter } from '@/components/PageFilter';
import { Timer } from '@/components/Timer';
import { JobService } from '@/lib/api';
import { searchStorage } from '@/lib/localStorage';
import { Job, SearchFormData } from '@/types/job';

export default function HomePage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchStarted, setSearchStarted] = useState(false);
  const [currentSearch, setCurrentSearch] = useState<SearchFormData | null>(null);

  // Load saved data on component mount
  useEffect(() => {
    const savedResults = searchStorage.loadSearchResults();
    if (savedResults) {
      setJobs(savedResults.jobs);
      setFilteredJobs(savedResults.jobs);
      setSearchStarted(savedResults.searchStarted);
      setCurrentSearch(savedResults.searchData);
    }
  }, []);

  const handleReset = () => {
    // Clear localStorage
    searchStorage.clearSearchData();
    
    // Reset all state to initial values
    setJobs([]);
    setFilteredJobs([]);
    setSearchStarted(false);
    setCurrentSearch(null);
    setError(null);
    setLoading(false);
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

    // Save search data to localStorage
    searchStorage.saveSearchData(searchData);

    try {
      const response = await JobService.searchJobs({
        site: searchData.site,
        location: searchData.location,
        job_title: searchData.jobTitle,
        results_wanted: searchData.resultsWanted,
        hours_old: searchData.hoursOld,
      });

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
          message: `Found ${response.jobs.length} jobs`,
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
    }
  };

  return (
    <>
      {!searchStarted ? (
        // Centered layout for initial state
        <Box style={{ backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
          <Container size="xl" style={{ minHeight: '100vh' }}>
            <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
              <Box style={{ width: '100%', maxWidth: '1200px' }}>
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
                  {/* Headline */}
                  <Title 
                    order={1} 
                    ta="center" 
                    mb="lg" 
                    style={{ 
                      color: '#37352f',
                      fontFamily: 'var(--font-horas), Arial Black, sans-serif',
                      fontWeight: 900
                    }}
                  >
                    searching the fox
                  </Title>
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
                  <SearchForm 
                    onSearch={handleSearch} 
                    loading={loading} 
                    initialValues={currentSearch || undefined}
                  />
                </Stack>
              </Box>
            </Box>
          </Container>
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
                  <Stack gap="md" align="center">
                    <Timer isRunning={loading} />
                    <Text fw={500} size="sm">Searching for jobs...</Text>
                    <Text size="sm" c="dimmed" ta="center">
                      This may take up to 2 minutes depending on the job board and number of results
                    </Text>
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
                    <JobTable jobs={filteredJobs} />
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
