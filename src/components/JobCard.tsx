'use client';

import {
  Card,
  Text,
  Badge,
  Group,
  Stack,
  Image,
  Box,
  rem,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { useMantineTheme } from '@mantine/core';
import { SecondaryButton } from './SecondaryButton';
import { CompanyLogo } from './CompanyLogo';
import { IconMapPin, IconCalendar, IconCurrency } from '@tabler/icons-react';
import { Job } from '@/types/job';

interface JobCardProps {
  job: Job;
  jobId: string;
  isSelected: boolean;
  onSelectionChange: (jobId: string, selected: boolean) => void;
}

export function JobCard({ job, jobId, isSelected, onSelectionChange }: JobCardProps) {
  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);
  
  // Use the same date formatting logic as JobTable
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

  // Use the same salary formatting logic as JobTable
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

  // Smart icon for job board (same logic as JobTable)
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

  // Mantine blue selection color
  const selectedBg = 'var(--mantine-color-blue-light)';
  const selectedBorder = 'var(--mantine-color-blue-filled)';

  // Card click handler
  const handleCardClick = (e: React.MouseEvent) => {
    // Prevent toggling when clicking the button
    const target = e.target as HTMLElement;
    if (target.closest('a,button')) return;
    onSelectionChange(jobId, !isSelected);
  };

  return (
    <Card
      shadow="sm"
      padding="lg"
      radius="md"
      withBorder
      style={isSelected ? { background: selectedBg, borderColor: selectedBorder, cursor: 'pointer' } : { cursor: 'pointer' }}
      onClick={handleCardClick}
    >
      <Stack gap="md">
        {/* Header with logo and company */}
        <Group justify="space-between" align="flex-start">
          <Group gap="md" align="flex-start">
            <CompanyLogo 
              companyName={job.company}
              logoUrl={job.company_logo_url}
              sourceSite={job.source_site}
              size={48}
            />
            
            <Box style={{ flex: 1 }}>
              <Text fw={600} size="lg" lineClamp={2}>
                {job.title}
              </Text>
              <Text c="dimmed" size="sm">
                {job.company}
              </Text>
            </Box>
          </Group>
        </Group>

        {/* Job details */}
        <Group gap="lg" align="flex-start">
          <Group gap="xs">
            <IconMapPin style={{ width: rem(16), height: rem(16) }} color="gray" />
            <Text size="sm" c="dimmed">
              {job.location}
            </Text>
          </Group>

          <Group gap="xs">
            <IconCalendar style={{ width: rem(16), height: rem(16) }} color="gray" />
            <Text size="sm" c="dimmed">
              {formatDate(job)}
            </Text>
          </Group>

          {formatSalary(job) !== 'Not specified' && (
            <Group gap="xs">
              <IconCurrency style={{ width: rem(16), height: rem(16) }} color="gray" />
              <Text size="sm" c="dimmed">
                {formatSalary(job)}
              </Text>
            </Group>
          )}
        </Group>

        {/* Badges for job type, remote, etc. */}
        <Group gap="xs">
          {job.is_remote && (
            <Badge color="green" variant="light" size="sm">
              Remote
            </Badge>
          )}
          {/* Hide job_type badge on mobile */}
          {!isMobile && job.job_type && job.job_type !== 'None' && (
            <Badge color="blue" variant="light" size="sm">
              {job.job_type}
            </Badge>
          )}
          {job.job_level && job.job_level !== 'None' && (
            <Badge color="gray" variant="light" size="sm">
              {job.job_level}
            </Badge>
          )}
        </Group>

        {/* View Button at the bottom, full width */}
        <SecondaryButton
          component="a"
          href={job.job_url}
          target="_blank"
          rel="noopener noreferrer"
          leftSection={
            <span style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
              {/* Fix logo size for Indeed and others */}
              <Image
                src={job.source_site === 'Indeed' || job.job_url?.includes('indeed.com') ? '/indeed.svg' : getJobBoardLogo(job.source_site, job.job_url)?.props?.src}
                alt={job.source_site || ''}
                width={20}
                height={20}
                style={{ objectFit: 'contain', maxHeight: 24 }}
              />
            </span>
          }
          fullWidth
        >
          View
        </SecondaryButton>
      </Stack>
    </Card>
  );
}
