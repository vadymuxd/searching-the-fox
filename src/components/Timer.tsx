'use client';

import { useState, useEffect } from 'react';
import { Text, Stack, Progress, Box } from '@mantine/core';

interface TimerProps {
  isRunning: boolean;
  onReset?: () => void;
  progressInfo?: {
    currentSite: string;
    completed: number;
    total: number;
  };
}

export function Timer({ isRunning, onReset, progressInfo }: TimerProps) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isRunning) {
      interval = setInterval(() => {
        setSeconds(prev => prev + 1);
      }, 1000);
    } else {
      setSeconds(0);
      if (onReset) {
        onReset();
      }
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isRunning, onReset]);

  const formatTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    if (minutes > 0) {
      return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
    return `${secs}s`;
  };

  return (
    <Stack gap="md" align="center">
      {progressInfo && (
        <Box style={{ width: '100%', maxWidth: '400px' }}>
          <Stack gap="sm">
            <Progress 
              value={(progressInfo.completed / progressInfo.total) * 100} 
              size="md"
              radius="md"
              color="blue"
              striped
              animated
            />
            <Text fw={500} size="md" ta="center" c="dark">
              Searching {progressInfo.currentSite} ({progressInfo.completed}/{progressInfo.total})
            </Text>
            <Text fw={600} size="lg" ta="center">
              {formatTime(seconds)}
            </Text>
            <Text size="xs" c="dimmed" ta="center">
              Searching multiple job boards will take several minutes (Usually between 1 and 5). This is because we are collecting and reorganized data from each site, which involves multiple requests and processing time. Do not close or refresh the page during this time.
            </Text>
          </Stack>
        </Box>
      )}
      {!progressInfo && (
        <>
          <Text fw={500} size="md" ta="center" c="dark">
            Searching for jobs...
          </Text>
          <Text fw={600} size="lg" ta="center">
            {formatTime(seconds)}
          </Text>
        </>
      )}
    </Stack>
  );
}
