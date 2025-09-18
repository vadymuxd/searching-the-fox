'use client';

import { useState } from 'react';
import {
  Group,
  TextInput,
  Button,
  rem,
} from '@mantine/core';
import { IconFilter } from '@tabler/icons-react';
import { SecondaryButton } from './SecondaryButton';
import { Job } from '@/types/job';

interface PageFilterProps {
  jobs: Job[];
  onFilteredJobsChange: (filteredJobs: Job[]) => void;
}

export function PageFilter({ jobs, onFilteredJobsChange }: PageFilterProps) {
  const [filterValue, setFilterValue] = useState('');

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

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleFilter();
    }
  };

  return (
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
  );
}
