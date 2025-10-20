'use client';

import React from 'react';
import { Progress, Stack, Text, Group } from '@mantine/core';

interface ProgressToastProps {
  current: number;
  total: number;
  targetStatus?: string;
  isComplete?: boolean;
}

export function ProgressToast({
  current,
  total,
  targetStatus,
  isComplete = false,
}: ProgressToastProps) {
  const percentage = total > 0 ? (current / total) * 100 : 0;

  if (isComplete) {
    return (
      <Stack gap={4}>
        <Text size="sm">
          Successfully updated {total} job{total !== 1 ? 's' : ''} to &quot;{targetStatus}&quot;
        </Text>
      </Stack>
    );
  }

  return (
    <Stack gap={6}>
      <Group justify="space-between" gap="xs">
        <Text size="sm">
          Updating jobs to &quot;{targetStatus}&quot;
        </Text>
        <Text size="sm" fw={500} c="dimmed">
          {current}/{total}
        </Text>
      </Group>
      <Progress value={percentage} size="xs" radius="md" striped animated />
    </Stack>
  );
}
