'use client';

import { useState } from 'react';
import {
  Container,
  Stack,
  Text,
  Paper,
  Alert,
  Box,
  Group,
  Loader,
  Progress,
  SegmentedControl,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconInfoCircle, IconAlertCircle, IconCheck } from '@tabler/icons-react';
import Lottie from 'lottie-react';
import { SearchForm } from '@/components/SearchForm';
import { JobCard } from '@/components/JobCard';
import { JobTable } from '@/components/JobTable';
import { JobService } from '@/lib/api';
import { Job, SearchFormData } from '@/types/job';
import ninjaAnimation from '../../public/ninja_buhes_adguard_vpn.json';

export default function HomePage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [searchStarted, setSearchStarted] = useState(false);

  const handleSearch = async (searchData: SearchFormData) => {
    setLoading(true);
    setError(null);
    setSearchStarted(true);
    setJobs([]);

    // Show initial notification
    const notificationId = notifications.show({
      title: 'Starting job search...',
      message: `Searching for ${searchData.jobTitle} in ${searchData.location}`,
      loading: true,
      autoClose: false,
    });

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
        
        // Update notification with success
        notifications.update({
          id: notificationId,
          title: 'Search completed!',
          message: `Found ${response.jobs.length} jobs`,
          icon: <IconCheck size={16} />,
          color: 'green',
          loading: false,
          autoClose: 3000,
        });
      } else {
        throw new Error(response.error || 'Failed to search jobs');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      
      // Update notification with error
      notifications.update({
        id: notificationId,
        title: 'Search failed',
        message: errorMessage,
        icon: <IconAlertCircle size={16} />,
        color: 'red',
        loading: false,
        autoClose: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container size="xl" py={searchStarted ? "xl" : 0} style={{ minHeight: '100vh' }}>
      {!searchStarted ? (
        // Centered layout for initial state
        <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
          <Box style={{ width: '100%', maxWidth: '1200px' }}>
            <Stack gap="0" align="center">
              {/* Lottie Animation */}
              <Box style={{ width: '200px', height: '150px' }}>
                <Lottie 
                  animationData={ninjaAnimation}
                  loop={true}
                  autoplay={true}
                  style={{ width: '100%', height: '100%' }}
                />
              </Box>
              {/* Search Form */}
              <SearchForm onSearch={handleSearch} loading={loading} />
            </Stack>
          </Box>
        </Box>
      ) : (
        // Top layout after search is started
        <Stack gap="xl">
          {/* Search Form */}
          <SearchForm onSearch={handleSearch} loading={loading} />

        {/* Loading Progress */}
        {loading && (
          <Paper p="md" radius="md" withBorder>
            <Stack gap="md" align="center">
              <Loader size="lg" />
              <Text fw={500}>Searching for jobs...</Text>
              <Text size="sm" c="dimmed" ta="center">
                This may take up to 2 minutes depending on the job board and number of results
              </Text>
              <Progress 
                value={100} 
                striped 
                animated 
                w="100%" 
                size="sm"
                color="blue"
              />
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
          >
            No jobs were found matching your criteria. Try adjusting your search terms or expanding your location.
          </Alert>
        )}

        {jobs.length > 0 && (
          <Stack gap="lg">
            {/* View Mode Toggle */}
            <Group justify="space-between" align="center">
              <Text fw={600} size="lg">
                {jobs.length} Jobs Found
              </Text>
              <SegmentedControl
                value={viewMode}
                onChange={(value: string) => setViewMode(value as 'cards' | 'table')}
                data={[
                  { label: 'Cards', value: 'cards' },
                  { label: 'Table', value: 'table' },
                ]}
              />
            </Group>

            {/* Job Results */}
            {viewMode === 'cards' ? (
              <Stack gap="md">
                {jobs.map((job: Job, index: number) => (
                  <JobCard key={index} job={job} />
                ))}
              </Stack>
            ) : (
              <JobTable jobs={jobs} />
            )}
          </Stack>
        )}
        </Stack>
      )}
    </Container>
  );
}
