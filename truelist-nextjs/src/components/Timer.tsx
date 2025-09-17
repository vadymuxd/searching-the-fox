'use client';

import { useState, useEffect } from 'react';
import { Text } from '@mantine/core';

interface TimerProps {
  isRunning: boolean;
  onReset?: () => void;
}

export function Timer({ isRunning, onReset }: TimerProps) {
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
    <Text fw={600} size="lg" ta="center">
      {formatTime(seconds)}
    </Text>
  );
}
