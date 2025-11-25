'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
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
  onSelectionChange?: (selectedCount: number) => void;
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
  onSelectionChange?: (selectedCount: number) => void;
  onSelectedJobsChange?: (selectedJobs: Array<{ userJobId: string; title: string; company: string; jobId: string }>) => void;
  clearSelections?: number; // Trigger to clear selections (increment to clear)
}

export function JobTable({ jobs, onSelectionChange, onSelectedJobsChange, clearSelections }: JobTableProps) {
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());
  const [sortState, setSortState] = useState<SortState>({ column: null, direction: null });

  // Clear selections when clearSelections prop changes
  useEffect(() => {
    if (clearSelections !== undefined && clearSelections > 0) {
      setSelectedJobs(new Set());
    }
  }, [clearSelections]);

  // Helper function to get job board logo
  const getJobBoardLogo = (sourceSite: string | undefined, jobUrl: string) => {
    // First, try to determine from sourceSite
    if (sourceSite) {
      const logoMap: Record<string, string> = {
        'LinkedIn': '/Linkedin.svg',
        'Indeed': '/indeed.svg',
      };

      const logoPath = logoMap[sourceSite];
      if (logoPath) {
        return (
          <Image
            src={logoPath}
            alt={sourceSite}
            width={16}
            height={16}
            style={{ objectFit: 'contain' }}
          />
        );
      }
    }

    // If sourceSite is not available or not in our map, try to determine from job URL
    if (jobUrl) {
      let detectedSite = '';
      let logoPath = '';

      if (jobUrl.includes('indeed.com')) {
        detectedSite = 'Indeed';
        logoPath = '/indeed.svg';
      } else if (jobUrl.includes('linkedin.com')) {
        detectedSite = 'LinkedIn';
        logoPath = '/Linkedin.svg';
      } else if (jobUrl.includes('glassdoor.com')) {
        detectedSite = 'Glassdoor';
        logoPath = '/Glassdoor.svg';
      } else if (jobUrl.includes('ziprecruiter.com')) {
        detectedSite = 'ZipRecruiter';
        logoPath = '/zip_recruiter.svg';
      }

      if (logoPath) {
        return (
          <Image
            src={logoPath}
            alt={detectedSite}
            width={16}
            height={16}
            style={{ objectFit: 'contain' }}
          />
        );
      }
    }

    return null;
  };

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

  // Selection state is only kept in memory during session (no localStorage)
  useEffect(() => {
    // Count only selected jobs that are currently visible (in the filtered jobs list)
    const visibleSelectedCount = jobs.filter(job => selectedJobs.has(getJobId(job))).length;
    
    // Get the selected job data for the parent component
    const selectedJobsData = jobs
      .filter(job => selectedJobs.has(getJobId(job)))
      .map(job => ({
        userJobId: job.user_job_id || '',
        title: job.title,
        company: job.company,
        jobId: getJobId(job),
      }));
      // Don't filter out jobs without user_job_id to support non-authenticated users
    
    // Notify parent component about selection change
    if (onSelectionChange) {
      onSelectionChange(visibleSelectedCount);
    }
    if (onSelectedJobsChange) {
      onSelectedJobsChange(selectedJobsData);
    }
  }, [selectedJobs, jobs, onSelectionChange, onSelectedJobsChange]);

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
    const visibleJobIds = sortedJobs.map(job => getJobId(job));
    const allVisibleSelected = visibleJobIds.every(jobId => selectedJobs.has(jobId));
    
    if (allVisibleSelected) {
      // Deselect all visible jobs but keep other selections
      const newSelected = new Set(selectedJobs);
      visibleJobIds.forEach(jobId => newSelected.delete(jobId));
      setSelectedJobs(newSelected);
    } else {
      // Select all visible jobs while keeping existing selections
      const newSelected = new Set(selectedJobs);
      visibleJobIds.forEach(jobId => newSelected.add(jobId));
      setSelectedJobs(newSelected);
    }
  };

  const setSorting = (field: SortableColumn) => {
    const reversed = sortState.column === field ? sortState.direction === 'desc' : false;
    setSortState({
      column: field,
      direction: reversed ? 'asc' : 'desc',
    });
  };

  // Helper function to parse date consistently, with created_at as fallback
  const parseDate = (job: Job): number => {
    const dateString = job.date_posted;
    const createdAt = job.created_at;
    
    // If date_posted is valid, use it
    if (dateString && dateString !== 'Not specified' && dateString !== 'null' && dateString !== 'undefined' && dateString !== 'None') {
      try {
        const date = new Date(dateString);
        if (!isNaN(date.getTime())) {
          return date.getTime();
        }
      } catch (error) {
        console.error('Date parsing error for date_posted:', error, 'for date:', dateString);
      }
    }
    
    // Fallback to created_at if date_posted is NULL or invalid
    if (createdAt) {
      try {
        const date = new Date(createdAt);
        if (!isNaN(date.getTime())) {
          return date.getTime();
        }
      } catch (error) {
        console.error('Date parsing error for created_at:', error, 'for date:', createdAt);
      }
    }
    
    // Final fallback to current time
    return Date.now();
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
        // Use the helper function for consistent date parsing
        return parseDate(job);
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

  const formatDate = (job: Job) => {
    // Use date_posted if available, otherwise fall back to created_at
    const dateString = job.date_posted;
    const createdAt = job.created_at;
    
    let date: Date | null = null;
    
    // Try date_posted first
    if (dateString && dateString !== 'Not specified' && dateString !== 'null' && dateString !== 'undefined' && dateString !== 'None') {
      try {
        const parsedDate = new Date(dateString);
        if (!isNaN(parsedDate.getTime())) {
          date = parsedDate;
        }
      } catch (error) {
        console.error('Date parsing error for date_posted:', error, 'for date:', dateString);
      }
    }
    
    // Fallback to created_at if date_posted is invalid or NULL
    if (!date && createdAt) {
      try {
        const parsedDate = new Date(createdAt);
        if (!isNaN(parsedDate.getTime())) {
          date = parsedDate;
        }
      } catch (error) {
        console.error('Date parsing error for created_at:', error, 'for date:', createdAt);
      }
    }
    
    // If no valid date, default to "Today"
    if (!date) {
      return 'Today';
    }
    
    const today = new Date();
    // Reset time to compare only dates
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    
    const diffTime = today.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    // Consistent format: always show as "X days ago"
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays} days ago`;
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

  const rows = sortedJobs.map((job) => {
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
            sourceSite={job.source_site}
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
            {formatDate(job)}
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
              leftSection={getJobBoardLogo(job.source_site, job.job_url)}
            >
              View
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
                checked={sortedJobs.length > 0 && sortedJobs.every(job => selectedJobs.has(getJobId(job)))}
                indeterminate={sortedJobs.some(job => selectedJobs.has(getJobId(job))) && !sortedJobs.every(job => selectedJobs.has(getJobId(job)))}
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
