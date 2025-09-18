'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Table,
  Text,
  rem,
  ScrollArea,
  Paper,
  UnstyledButton,
  Group,
  Center,
  Checkbox,
  Box,
} from '@mantine/core';
import { IconChevronUp, IconChevronDown, IconSelector } from '@tabler/icons-react';
import { Job } from '@/types/job';
import { SecondaryButton } from './SecondaryButton';
import { CompanyLogo } from './CompanyLogo';

interface JobTableProps {
  jobs: Job[];
}

type SortableColumn = 'title' | 'company' | 'location' | 'salary' | 'date_posted';
type SortDirection = 'asc' | 'desc' | null;

interface SortState {
  column: SortableColumn | null;
  direction: SortDirection;
}

interface ThProps {
  children: React.ReactNode;
  reversed?: boolean;
  sorted?: boolean;
  onSort?(): void;
  width?: number | string;
  style?: React.CSSProperties;
}

function Th({ children, reversed, sorted, onSort, width, style }: ThProps) {
  const Icon = sorted ? (reversed ? IconChevronUp : IconChevronDown) : IconSelector;
  
  return (
    <Table.Th style={{ ...style, width }} onClick={onSort}>
      {onSort ? (
        <UnstyledButton
          style={{
            padding: 0,
            width: '100%',
            textAlign: 'left',
          }}
          onClick={onSort}
        >
          <Group justify="space-between" wrap="nowrap">
            <Text fw={500} fz="sm">
              {children}
            </Text>
            <Center>
              <Icon style={{ width: rem(16), height: rem(16) }} stroke={1.5} />
            </Center>
          </Group>
        </UnstyledButton>
      ) : (
        <Text fw={500} fz="sm">
          {children}
        </Text>
      )}
    </Table.Th>
  );
}

// Special header component for form elements like checkboxes
function FormTh({ children, width, style }: { children: React.ReactNode; width?: number | string; style?: React.CSSProperties }) {
  return (
    <Table.Th style={{ ...style, width }}>
      <Box style={{ fontWeight: 500, fontSize: rem(14), display: 'flex', alignItems: 'center' }}>
        {children}
      </Box>
    </Table.Th>
  );
}

interface JobTableProps {
  jobs: Job[];
}

export function JobTable({ jobs }: JobTableProps) {
  const [sortState, setSortState] = useState<SortState>({ column: null, direction: null });
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());

  // Create a unique identifier for each job based on its properties
  const getJobId = (job: Job): string => {
    // Use a combination of properties that should be unique for each job
    const baseId = `${job.company}-${job.title}-${job.location}-${job.job_url || ''}`;
    // Create a simple hash to make it shorter but still unique
    let hash = 0;
    for (let i = 0; i < baseId.length; i++) {
      const char = baseId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString();
  };

  // Clear selections when jobs array changes (new search or filter)
  // but keep selections that still exist in the new jobs array
  useEffect(() => {
    const currentJobIds = new Set(jobs.map(job => getJobId(job)));
    const validSelections = new Set(
      Array.from(selectedJobs).filter(jobId => currentJobIds.has(jobId))
    );
    
    // Only update if selections changed
    if (validSelections.size !== selectedJobs.size || 
        !Array.from(validSelections).every(id => selectedJobs.has(id))) {
      setSelectedJobs(validSelections);
    }
  }, [jobs, selectedJobs]);

  const toggleJobSelection = (jobId: string) => {
    const newSelected = new Set(selectedJobs);
    if (newSelected.has(jobId)) {
      newSelected.delete(jobId);
    } else {
      newSelected.add(jobId);
    }
    setSelectedJobs(newSelected);
  };

  const toggleAllJobs = () => {
    if (selectedJobs.size === sortedJobs.length) {
      setSelectedJobs(new Set());
    } else {
      const allJobIds = new Set(sortedJobs.map(job => getJobId(job)));
      setSelectedJobs(allJobIds);
    }
  };

  const setSorting = (field: SortableColumn) => {
    const reversed = sortState.column === field ? sortState.direction === 'desc' : false;
    setSortState({
      column: field,
      direction: reversed ? 'asc' : 'desc',
    });
  };

  const getSortValue = (job: Job, column: SortableColumn): string | number => {
    switch (column) {
      case 'title':
        return job.title.toLowerCase();
      case 'company':
        return job.company.toLowerCase();
      case 'location':
        return job.location.toLowerCase();
      case 'salary':
        // For salary sorting, use the numeric value for proper comparison
        if (job.salary_min) return job.salary_min;
        if (job.min_amount) return job.min_amount;
        return 0; // No salary specified
      case 'date_posted':
        // Convert date to timestamp for sorting
        if (!job.date_posted || job.date_posted === 'Not specified' || job.date_posted === 'null' || job.date_posted === 'undefined' || job.date_posted === 'None') {
          return Date.now(); // Recent date for "Today"
        }
        const date = new Date(job.date_posted);
        return isNaN(date.getTime()) ? Date.now() : date.getTime();
      default:
        return '';
    }
  };

  const sortedJobs = useMemo(() => {
    if (!sortState.column || !sortState.direction) {
      return jobs;
    }

    return [...jobs].sort((a, b) => {
      const aValue = getSortValue(a, sortState.column!);
      const bValue = getSortValue(b, sortState.column!);
      
      let comparison = 0;
      if (aValue < bValue) comparison = -1;
      if (aValue > bValue) comparison = 1;
      
      return sortState.direction === 'desc' ? -comparison : comparison;
    });
  }, [jobs, sortState]);

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString || dateString === 'Not specified' || dateString === 'null' || dateString === 'undefined' || dateString === 'None') {
      return 'Today';
    }
    
    try {
      const date = new Date(dateString);
      
      // Check if the date is valid
      if (isNaN(date.getTime())) {
        return 'Today';
      }
      
      const today = new Date();
      // Reset time to compare only dates
      today.setHours(0, 0, 0, 0);
      date.setHours(0, 0, 0, 0);
      
      const diffTime = today.getTime() - date.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays} days ago`;
      if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
      
      return date.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
      });
    } catch (error) {
      console.error('Date parsing error:', error, 'for date:', dateString);
      return 'Today';
    }
  };

  const formatSalary = (job: Job) => {
    // First, check if there's a direct salary string
    if (job.salary && job.salary !== 'Not specified' && job.salary !== 'null' && job.salary !== 'undefined' && job.salary !== 'None') {
      return job.salary;
    }
    
    // Then check for API salary fields (salary_min, salary_max, salary_currency)
    if (job.salary_min || job.salary_max) {
      const currency = job.salary_currency || '$';
      const interval = job.interval ? ` ${job.interval}` : '';
      
      if (job.salary_min && job.salary_max) {
        return `${currency}${job.salary_min.toLocaleString()} - ${currency}${job.salary_max.toLocaleString()}${interval}`;
      } else if (job.salary_min) {
        return `${currency}${job.salary_min.toLocaleString()}+${interval}`;
      } else if (job.salary_max) {
        return `Up to ${currency}${job.salary_max.toLocaleString()}${interval}`;
      }
    }
    
    // Fallback to legacy fields (min_amount, max_amount, currency)
    if (job.min_amount || job.max_amount) {
      const currency = job.currency || '$';
      const interval = job.interval ? ` ${job.interval}` : '';
      
      if (job.min_amount && job.max_amount) {
        return `${currency}${job.min_amount.toLocaleString()} - ${currency}${job.max_amount.toLocaleString()}${interval}`;
      } else if (job.min_amount) {
        return `${currency}${job.min_amount.toLocaleString()}+${interval}`;
      } else if (job.max_amount) {
        return `Up to ${currency}${job.max_amount.toLocaleString()}${interval}`;
      }
    }
    
    return 'Not specified';
  };

  if (jobs.length === 0) {
    return (
      <Paper p="xl" ta="center">
        <Text c="dimmed" size="sm">No jobs found. Try adjusting your search criteria.</Text>
      </Paper>
    );
  }

  const rows = sortedJobs.map((job, index) => {
    const jobId = getJobId(job);
    const isSelected = selectedJobs.has(jobId);
    
    return (
      <Table.Tr 
        key={jobId} // Use jobId as key instead of index
        style={{ 
          cursor: 'pointer',
          backgroundColor: isSelected ? 'var(--mantine-color-blue-light)' : undefined,
        }}
        data-selected={isSelected || undefined}
        onClick={() => toggleJobSelection(jobId)}
      >
        {/* Checkbox */}
        <Table.Td>
          <Checkbox
            checked={isSelected}
            onChange={() => toggleJobSelection(jobId)}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Select ${job.title} at ${job.company}`}
          />
        </Table.Td>

        {/* Company Logo */}
        <Table.Td>
          <CompanyLogo 
            companyName={job.company}
            logoUrl={job.company_logo_url}
            size={40}
          />
        </Table.Td>

        {/* Job Title */}
        <Table.Td style={{ minWidth: 200 }}>
          <Text fw={600} size="sm" lineClamp={2}>
            {job.title}
          </Text>
        </Table.Td>

        {/* Company */}
        <Table.Td style={{ minWidth: 150 }}>
          <Text size="sm">
            {job.company}
          </Text>
        </Table.Td>

        {/* Location */}
        <Table.Td>
          <Text size="sm" lineClamp={1}>
            {job.location}
          </Text>
        </Table.Td>

        {/* Salary */}
        <Table.Td>
          <Text size="sm" lineClamp={1}>
            {formatSalary(job)}
          </Text>
        </Table.Td>

        {/* Date Posted */}
        <Table.Td>
          <Text size="sm">
            {formatDate(job.date_posted)}
          </Text>
        </Table.Td>

        {/* Link Button */}
        <Table.Td>
          <div onClick={(e) => e.stopPropagation()}>
            <SecondaryButton
              component="a"
              href={job.job_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              View Job
            </SecondaryButton>
          </div>
        </Table.Td>
      </Table.Tr>
    );
  });

  return (
    <ScrollArea>
      <Table highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <FormTh width={50}>
              <Checkbox
                checked={selectedJobs.size === sortedJobs.length && sortedJobs.length > 0}
                indeterminate={selectedJobs.size > 0 && selectedJobs.size < sortedJobs.length}
                onChange={toggleAllJobs}
                aria-label="Select all jobs"
              />
            </FormTh>
            <Th width={60}>Logo</Th>
            <Th 
              style={{ minWidth: 200 }}
              sorted={sortState.column === 'title'}
              reversed={sortState.direction === 'desc'}
              onSort={() => setSorting('title')}
            >
              Job Title
            </Th>
            <Th 
              style={{ minWidth: 150 }}
              sorted={sortState.column === 'company'}
              reversed={sortState.direction === 'desc'}
              onSort={() => setSorting('company')}
            >
              Company
            </Th>
            <Th 
              width={200}
              sorted={sortState.column === 'location'}
              reversed={sortState.direction === 'desc'}
              onSort={() => setSorting('location')}
            >
              Location
            </Th>
            <Th 
              width={150}
              sorted={sortState.column === 'salary'}
              reversed={sortState.direction === 'desc'}
              onSort={() => setSorting('salary')}
            >
              Salary
            </Th>
            <Th 
              width={120}
              sorted={sortState.column === 'date_posted'}
              reversed={sortState.direction === 'desc'}
              onSort={() => setSorting('date_posted')}
            >
              Posted
            </Th>
            <Th width={100}>Link</Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>{rows}</Table.Tbody>
      </Table>
    </ScrollArea>
  );
}
