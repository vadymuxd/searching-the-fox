'use client';

import {
  Card,
  Text,
  Badge,
  Group,
  Stack,
  Image,
  Avatar,
  Box,
  ActionIcon,
  Tooltip,
  rem,
} from '@mantine/core';
import { IconMapPin, IconCalendar, IconCurrency, IconExternalLink, IconBuilding } from '@tabler/icons-react';
import { Job } from '@/types/job';

interface JobCardProps {
  job: Job;
}

export function JobCard({ job }: JobCardProps) {
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const today = new Date();
      const diffTime = today.getTime() - date.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays} days ago`;
      
      return date.toLocaleDateString();
    } catch {
      return 'Today';
    }
  };

  const formatSalary = () => {
    if (job.salary) return job.salary;
    if (job.min_amount && job.max_amount) {
      return `${job.currency || '$'}${job.min_amount?.toLocaleString()} - ${job.currency || '$'}${job.max_amount?.toLocaleString()}${job.interval ? ` ${job.interval}` : ''}`;
    }
    return null;
  };

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Stack gap="md">
        {/* Header with logo and company */}
        <Group justify="space-between" align="flex-start">
          <Group gap="md" align="flex-start">
            {job.company_logo_url ? (
              <Image
                src={job.company_logo_url}
                alt={`${job.company} logo`}
                w={48}
                h={48}
                radius="md"
                fallbackSrc="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='2' y='3' width='20' height='14' rx='2' ry='2'/%3E%3Cline x1='8' y1='21' x2='16' y2='21'/%3E%3Cline x1='12' y1='17' x2='12' y2='21'/%3E%3C/svg%3E"
              />
            ) : (
              <Avatar size={48} radius="md">
                <IconBuilding style={{ width: rem(24), height: rem(24) }} />
              </Avatar>
            )}
            
            <Box style={{ flex: 1 }}>
              <Text fw={600} size="lg" lineClamp={2}>
                {job.title}
              </Text>
              <Text c="dimmed" size="sm">
                {job.company}
              </Text>
            </Box>
          </Group>

          <Tooltip label="View Job">
            <ActionIcon
              component="a"
              href={job.job_url}
              target="_blank"
              rel="noopener noreferrer"
              variant="light"
              size="lg"
            >
              <IconExternalLink style={{ width: rem(16), height: rem(16) }} />
            </ActionIcon>
          </Tooltip>
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
              {formatDate(job.date_posted)}
            </Text>
          </Group>

          {formatSalary() && (
            <Group gap="xs">
              <IconCurrency style={{ width: rem(16), height: rem(16) }} color="gray" />
              <Text size="sm" c="dimmed">
                {formatSalary()}
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
          {job.job_type && (
            <Badge color="blue" variant="light" size="sm">
              {job.job_type}
            </Badge>
          )}
          {job.job_level && (
            <Badge color="gray" variant="light" size="sm">
              {job.job_level}
            </Badge>
          )}
        </Group>

        {/* Description preview */}
        {job.description && (
          <Text size="sm" c="dimmed" lineClamp={3}>
            {job.description.replace(/<[^>]*>/g, '')} {/* Remove HTML tags */}
          </Text>
        )}
      </Stack>
    </Card>
  );
}
