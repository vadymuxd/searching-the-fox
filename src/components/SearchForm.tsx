'use client';

import { useEffect, useMemo } from 'react';
import Image from 'next/image';
import {
  Box,
  TextInput,
  Select,
  Button,
  Group,
  Stack,
  rem,
  useMantineTheme,
  Flex,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { useForm } from '@mantine/form';
import { IconSearch, IconMapPin, IconBuilding, IconClock } from '@tabler/icons-react';
import { SearchFormData } from '@/types/job';
import { SITE_OPTIONS } from '@/lib/api';

interface SearchFormProps {
  onSearch: (data: SearchFormData) => void;
  onReset?: () => void;
  loading?: boolean;
  initialValues?: Partial<SearchFormData>;
  showLogo?: boolean;
}

export function SearchForm({ onSearch, onReset, loading = false, initialValues, showLogo = true }: SearchFormProps) {
  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);
  
  // Memoize initialValues to prevent unnecessary re-renders
  const memoizedInitialValues = useMemo(() => initialValues, [
    initialValues,
  ]);

  const form = useForm<SearchFormData>({
    initialValues: {
      jobTitle: memoizedInitialValues?.jobTitle || '',
      location: memoizedInitialValues?.location || 'London',
      site: memoizedInitialValues?.site || 'all',
      resultsWanted: memoizedInitialValues?.resultsWanted || 1000,
      hoursOld: memoizedInitialValues?.hoursOld || '24',
    },
    validate: {
      jobTitle: (value) => (value.length < 1 ? 'Job title is required' : null),
      location: (value) => (value.length < 2 ? 'Location must be at least 2 characters' : null),
    },
  });

  // Update form values when memoized initialValues change
  useEffect(() => {
    if (memoizedInitialValues) {
      form.setValues({
        jobTitle: memoizedInitialValues.jobTitle || '',
        location: memoizedInitialValues.location || 'London',
        site: memoizedInitialValues.site || 'all',
        resultsWanted: memoizedInitialValues.resultsWanted || 1000,
        hoursOld: memoizedInitialValues.hoursOld || '24',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memoizedInitialValues]);

  const handleSubmit = (values: SearchFormData) => {
    onSearch(values);
  };

  return (
    <Box py="xl">
      <Stack gap="lg">
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="md">
            {isMobile ? (
              // Mobile layout: Single column, full width inputs
              <Stack gap="md">
                {/* Fox Logo - Home Button */}
                {onReset && showLogo && (
                  <Flex justify="center">
                    <Box 
                      onClick={onReset}
                      style={{ 
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        opacity: 0.8,
                        transition: 'opacity 0.2s ease',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                      onMouseLeave={(e) => e.currentTarget.style.opacity = '0.8'}
                    >
                      <Image 
                        src="/Searching-The-Fox.svg"
                        alt="Searching The Fox - Home"
                        width={40}
                        height={40}
                        style={{ objectFit: 'contain' }}
                      />
                    </Box>
                  </Flex>
                )}
                
                <TextInput
                  label="Job Title"
                  placeholder="e.g. Marketing Manager, Software Engineer"
                  leftSection={<IconSearch style={{ width: rem(16), height: rem(16) }} />}
                  {...form.getInputProps('jobTitle')}
                />
                <TextInput
                  label="Location"
                  placeholder="e.g. London, UK"
                  leftSection={<IconMapPin style={{ width: rem(16), height: rem(16) }} />}
                  {...form.getInputProps('location')}
                />
                <Select
                  label="Job Board"
                  leftSection={<IconBuilding style={{ width: rem(16), height: rem(16) }} />}
                  data={SITE_OPTIONS}
                  {...form.getInputProps('site')}
                />
                <Select
                  label="Posted Within"
                  leftSection={<IconClock style={{ width: rem(16), height: rem(16) }} />}
                  data={[
                    { value: '1', label: 'Past 1 hour' },
                    { value: '24', label: 'Past 24 hours' },
                    { value: '72', label: 'Past 3 days' },
                    { value: '168', label: 'Past week' },
                    { value: '720', label: 'Past month' },
                  ]}
                  {...form.getInputProps('hoursOld')}
                />
                <Button
                  type="submit"
                  loading={loading}
                  leftSection={<IconSearch style={{ width: rem(16), height: rem(16) }} />}
                  size="sm"
                  fullWidth
                >
                  {loading ? 'Searching...' : 'Search'}
                </Button>
              </Stack>
            ) : (
              // Desktop layout: Single row with logo and search criteria
              <Group gap="md" align="end" wrap="wrap">
                {/* Fox Logo - Home Button */}
                {onReset && showLogo && (
                  <Box 
                    onClick={onReset}
                    style={{ 
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'flex-end',
                      height: '36px',
                      paddingBottom: '0px',
                      opacity: 0.8,
                      transition: 'opacity 0.2s ease',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = '0.8'}
                  >
                    <Image 
                      src="/Searching-The-Fox.svg"
                      alt="Searching The Fox - Home"
                      width={40}
                      height={40}
                      style={{ objectFit: 'contain' }}
                    />
                  </Box>
                )}
                
                <TextInput
                  label="Job Title"
                  placeholder="e.g. Marketing Manager, Software Engineer"
                  leftSection={<IconSearch style={{ width: rem(16), height: rem(16) }} />}
                  {...form.getInputProps('jobTitle')}
                  style={{ flex: '4 1 200px', minWidth: '200px' }}
                />
                <TextInput
                  label="Location"
                  placeholder="e.g. London, UK"
                  leftSection={<IconMapPin style={{ width: rem(16), height: rem(16) }} />}
                  {...form.getInputProps('location')}
                  style={{ flex: '3 1 150px', minWidth: '150px' }}
                />
                <Select
                  label="Job Board"
                  leftSection={<IconBuilding style={{ width: rem(16), height: rem(16) }} />}
                  data={SITE_OPTIONS}
                  {...form.getInputProps('site')}
                  style={{ flex: '2 1 120px', minWidth: '120px' }}
                />
                <Select
                  label="Posted Within"
                  leftSection={<IconClock style={{ width: rem(16), height: rem(16) }} />}
                  data={[
                    { value: '1', label: 'Past 1 hour' },
                    { value: '24', label: 'Past 24 hours' },
                    { value: '72', label: 'Past 3 days' },
                    { value: '168', label: 'Past week' },
                    { value: '720', label: 'Past month' },
                  ]}
                  {...form.getInputProps('hoursOld')}
                  style={{ flex: '2 1 140px', minWidth: '140px' }}
                />
                <Button
                  type="submit"
                  loading={loading}
                  leftSection={<IconSearch style={{ width: rem(16), height: rem(16) }} />}
                  size="sm"
                  styles={{
                    root: {
                      height: rem(36),
                      width: rem(120), // Fixed width
                      minWidth: rem(120),
                      paddingLeft: rem(8),
                      paddingRight: rem(8),
                      flexShrink: 0, // Prevent shrinking
                    },
                    label: {
                      fontSize: rem(14),
                    },
                  }}
                >
                  {loading ? 'Searching...' : 'Search'}
                </Button>
              </Group>
            )}
          </Stack>
        </form>
      </Stack>
    </Box>
  );
}
