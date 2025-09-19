'use client';

import { useState, useEffect } from 'react';
import {
  Group,
  TextInput,
  Button,
  rem,
  Stack,
  useMantineTheme,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconFilter, IconDeviceFloppy, IconClipboard } from '@tabler/icons-react';
import { SecondaryButton } from './SecondaryButton';
import { IconButton } from './IconButton';
import { Job } from '@/types/job';
import { searchStorage } from '@/lib/localStorage';

interface PageFilterProps {
  jobs: Job[];
  onFilteredJobsChange: (filteredJobs: Job[]) => void;
}

export function PageFilter({ jobs, onFilteredJobsChange }: PageFilterProps) {
  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);
  const [filterValue, setFilterValue] = useState('');
  const [hasSavedFilter, setHasSavedFilter] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Check if there are saved filters on component mount
  useEffect(() => {
    setMounted(true);
    setHasSavedFilter(searchStorage.hasPageFilter());
  }, []);

  const handleFilter = () => {
    if (!filterValue.trim()) {
      onFilteredJobsChange(jobs);
      return;
    }

    // Split by comma and clean up the terms
    const searchTerms = filterValue
      .split(',')
      .map(term => term.trim().toLowerCase())
      .filter(term => term.length > 0);

    if (searchTerms.length === 0) {
      onFilteredJobsChange(jobs);
      return;
    }

    // Filter jobs that match any of the search terms in their title
    const filteredJobs = jobs.filter(job => {
      const jobTitle = job.title.toLowerCase();
      return searchTerms.some(term => jobTitle.includes(term));
    });

    onFilteredJobsChange(filteredJobs);
  };

  const handleClear = () => {
    setFilterValue('');
    onFilteredJobsChange(jobs);
  };

  const handleSave = () => {
    if (filterValue.trim()) {
      searchStorage.savePageFilter(filterValue);
      setHasSavedFilter(true);
    }
  };

  const handlePaste = () => {
    const savedFilter = searchStorage.loadPageFilter();
    if (savedFilter) {
      setFilterValue(savedFilter);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleFilter();
    }
  };

  return (
    <>
      {isMobile ? (
        // Mobile layout: Input on first line, buttons on second line
        <Stack gap="md">
          <TextInput
            placeholder="Filter by job titles (comma separated)"
            leftSection={<IconFilter style={{ width: rem(16), height: rem(16) }} />}
            value={filterValue}
            onChange={(event) => setFilterValue(event.currentTarget.value)}
            onKeyPress={handleKeyPress}
            size="sm"
          />
          
          <Group gap="md" grow>
            {/* Save button - always visible */}
            <IconButton onClick={handleSave} title="Save filter preferences">
              <IconDeviceFloppy style={{ width: rem(16), height: rem(16) }} />
            </IconButton>
            
            {/* Paste button - only visible when there are saved filters */}
            {mounted && hasSavedFilter && (
              <IconButton onClick={handlePaste} title="Paste saved filter preferences">
                <IconClipboard style={{ width: rem(16), height: rem(16) }} />
              </IconButton>
            )}
            
            <SecondaryButton onClick={handleClear}>
              Clear
            </SecondaryButton>
            <Button
              onClick={handleFilter}
              size="sm"
              styles={{
                root: {
                  backgroundColor: '#000',
                  border: '1px solid #000',
                  height: rem(36),
                  '&:hover': {
                    backgroundColor: '#333',
                    borderColor: '#333',
                  },
                },
                label: {
                  fontSize: rem(14),
                },
              }}
            >
              Filter
            </Button>
          </Group>
        </Stack>
      ) : (
        // Desktop layout: Single row
        <Group gap="md" align="end" wrap="nowrap">
          <TextInput
            placeholder="Filter by job titles (comma separated)"
            leftSection={<IconFilter style={{ width: rem(16), height: rem(16) }} />}
            value={filterValue}
            onChange={(event) => setFilterValue(event.currentTarget.value)}
            onKeyPress={handleKeyPress}
            style={{ flex: 1, minWidth: '200px' }}
            size="sm"
          />
          
          {/* Save button - always visible */}
          <IconButton onClick={handleSave} title="Save filter preferences">
            <IconDeviceFloppy style={{ width: rem(16), height: rem(16) }} />
          </IconButton>
          
          {/* Paste button - only visible when there are saved filters */}
          {mounted && hasSavedFilter && (
            <IconButton onClick={handlePaste} title="Paste saved filter preferences">
              <IconClipboard style={{ width: rem(16), height: rem(16) }} />
            </IconButton>
          )}
          
          <SecondaryButton onClick={handleClear}>
            Clear
          </SecondaryButton>
          <Button
            onClick={handleFilter}
            size="sm"
            styles={{
              root: {
                backgroundColor: '#000',
                border: '1px solid #000',
                height: rem(36),
                minWidth: '80px',
                paddingLeft: rem(12),
                paddingRight: rem(12),
                '&:hover': {
                  backgroundColor: '#333',
                  borderColor: '#333',
                },
              },
              label: {
                fontSize: rem(14),
              },
            }}
          >
            Filter
          </Button>
        </Group>
      )}
    </>
  );
}
