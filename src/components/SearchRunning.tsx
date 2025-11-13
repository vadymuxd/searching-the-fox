'use client';

import { useEffect, useState } from 'react';
import { Box, Text, Stack, Group, Transition } from '@mantine/core';
import { IconCheck, IconX } from '@tabler/icons-react';

interface SearchRunningProps {
  startedAt: string; // ISO timestamp when search started
  status: 'pending' | 'running' | 'success' | 'failed';
  onComplete?: () => void; // Callback when search completes (success or failed)
  site?: string; // Which site is being searched
}

export function SearchRunning({ startedAt, status, onComplete, site }: SearchRunningProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  // Calculate elapsed time from when search started
  useEffect(() => {
    const calculateElapsed = () => {
      const start = new Date(startedAt).getTime();
      const now = Date.now();
      return Math.floor((now - start) / 1000);
    };

    // Set initial elapsed time
    setElapsedSeconds(calculateElapsed());

    // Update every second if search is still running
    if (status === 'pending' || status === 'running') {
      const interval = setInterval(() => {
        setElapsedSeconds(calculateElapsed());
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [startedAt, status]);

  // When status changes to success or failed, wait a bit then notify parent
  useEffect(() => {
    if (status === 'success' || status === 'failed') {
      // Show completion status for 2 seconds before calling onComplete
      const timer = setTimeout(() => {
        setIsVisible(false);
        // Wait for fade out animation to complete
        setTimeout(() => {
          if (onComplete) {
            onComplete();
          }
          // Force browser refresh after the component disappears so the
          // user sees updated jobs fetched to the database
          if (typeof window !== 'undefined') {
            window.location.reload();
          }
        }, 300);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [status, onComplete]);

  // Format seconds to display (e.g., "45s" or "1:23")
  const formatTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // Determine background color based on status
  const getBackgroundColor = () => {
    if (status === 'success') return '#228be6'; // blue
    if (status === 'failed') return '#fa5252'; // red
    return '#228be6'; // blue for pending/running
  };

  // Determine message based on status
  const getMessage = () => {
    if (status === 'success') return 'Search completed';
    if (status === 'failed') return 'Search failed';
    if (status === 'pending') return 'Search queued...';
    return 'Searching jobs';
  };

  // Determine if we should show the icon instead of timer
  const showIcon = status === 'success' || status === 'failed';

  return (
    <Transition
      mounted={isVisible}
      transition="fade"
      duration={300}
      timingFunction="ease"
    >
      {(styles) => (
        <Box
          style={{
            ...styles,
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 1000,
            maxWidth: '320px',
          }}
        >
          <Box
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              padding: '16px',
              border: '1px solid #e9ecef',
            }}
          >
            <Group gap="md" wrap="nowrap">
              {/* Timer Circle or Status Icon */}
              <Box
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  backgroundColor: getBackgroundColor(),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {showIcon ? (
                  status === 'success' ? (
                    <IconCheck size={24} color="#ffffff" stroke={2.5} />
                  ) : (
                    <IconX size={24} color="#ffffff" stroke={2.5} />
                  )
                ) : (
                  <Text
                    fw={600}
                    size="sm"
                    style={{ color: '#ffffff', lineHeight: 1 }}
                  >
                    {formatTime(elapsedSeconds)}
                  </Text>
                )}
              </Box>

              {/* Message */}
              <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
                <Text fw={600} size="sm" style={{ lineHeight: 1.3 }}>
                  {getMessage()}
                </Text>
                {site && (status === 'running' || status === 'pending') && (
                  <Text size="xs" c="dimmed" style={{ lineHeight: 1.3 }}>
                    {site === 'all' ? 'Searching all job boards' : `Searching ${site}`}
                  </Text>
                )}
              </Stack>
            </Group>
          </Box>
        </Box>
      )}
    </Transition>
  );
}
