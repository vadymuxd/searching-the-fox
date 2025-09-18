'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import {
  Box,
  TextInput,
  Select,
  Button,
  Group,
  Stack,
  rem,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconSearch, IconMapPin, IconBuilding, IconClock } from '@tabler/icons-react';
import { SearchFormData } from '@/types/job';
import { SITE_OPTIONS } from '@/lib/api';

interface SearchFormProps {
  onSearch: (data: SearchFormData) => void;
  onReset?: () => void;
  loading?: boolean;
  initialValues?: Partial<SearchFormData>;
}

export function SearchForm({ onSearch, onReset, loading = false, initialValues }: SearchFormProps) {
  const form = useForm<SearchFormData>({
    initialValues: {
      jobTitle: initialValues?.jobTitle || '',
      location: initialValues?.location || 'London',
      site: initialValues?.site || 'all',
      resultsWanted: initialValues?.resultsWanted || 1000,
      hoursOld: initialValues?.hoursOld || '24',
    },
    validate: {
      jobTitle: (value) => (value.length < 1 ? 'Job title is required' : null),
      location: (value) => (value.length < 2 ? 'Location must be at least 2 characters' : null),
    },
  });

  // Update form values when initialValues change
  useEffect(() => {
    if (initialValues) {
      form.setValues({
        jobTitle: initialValues.jobTitle || '',
        location: initialValues.location || 'London',
        site: initialValues.site || 'all',
        resultsWanted: initialValues.resultsWanted || 1000,
        hoursOld: initialValues.hoursOld || '24',
      });
    }
  }, [
    form,
    initialValues,
    initialValues?.jobTitle,
    initialValues?.location,
    initialValues?.site,
    initialValues?.resultsWanted,
    initialValues?.hoursOld,
  ]);

  const handleSubmit = (values: SearchFormData) => {
    onSearch(values);
  };

  return (
    <Box py="xl">
      <Stack gap="lg">
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="md">
            {/* Single row with logo and search criteria */}
            <Group gap="md" align="end" wrap="wrap">
              {/* Fox Logo - Home Button */}
              {onReset && (
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
          </Stack>
        </form>
      </Stack>
    </Box>
  );
}
