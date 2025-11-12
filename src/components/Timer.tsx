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
  initialElapsedTime?: number; // Support resuming from persisted time
}

export function Timer({ isRunning, onReset, progressInfo, initialElapsedTime = 0 }: TimerProps) {
  const [seconds, setSeconds] = useState(initialElapsedTime);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isRunning) {
      // Set initial time if provided (for resuming persisted searches)
      if (initialElapsedTime > 0 && seconds === 0) {
        setSeconds(initialElapsedTime);
      }
      
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
  }, [isRunning, onReset, initialElapsedTime, seconds]);

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
              size={6} // 50% thicker than default 'xs' (4px)
              radius="md"
              color="blue"
              striped
              animated
            />
            <Text fw={500} size="md" ta="center" c="dark">
              {progressInfo.total === 1
                ? `Searching ${progressInfo.currentSite}`
                : `Searching ${progressInfo.currentSite} (${progressInfo.completed}/${progressInfo.total})`}
            </Text>
            <Text fw={600} size="lg" ta="center">
              {formatTime(seconds)}
            </Text>
            {progressInfo.total > 1 && (
              <Text size="xs" c="dimmed" ta="center">
                Searching multiple job boards might take between 1 and 5 minutes. Do not close or refresh the page during this time.
              </Text>
            )}
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
