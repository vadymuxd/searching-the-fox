'use client';

import { useState, useEffect, useRef } from 'react';
import { Text, Stack, Image, Box } from '@mantine/core';
import { geminiService } from '../lib/geminiService';

interface LoadingInsightProps {
  isActive: boolean; // When true, start fetching insights
}

export function LoadingInsight({ isActive }: LoadingInsightProps) {
  const [insight, setInsight] = useState<string>('');
  const [isVisible, setIsVisible] = useState(false);
  const [isFading, setIsFading] = useState(false);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isLoadingRef = useRef(false);
  const lastFetchTimeRef = useRef(0);

  useEffect(() => {
    const fetchInsight = async () => {
      // Prevent concurrent requests
      if (isLoadingRef.current) return;
      
      // Rate limiting: minimum 19 seconds between requests
      const now = Date.now();
      if (now - lastFetchTimeRef.current < 19000) return;

      isLoadingRef.current = true;
      lastFetchTimeRef.current = now;

      try {
        const newInsight = await geminiService.getJobSeekerInsight();
        if (newInsight && newInsight.trim()) {
          // Start fade out animation
          setIsFading(true);
          setTimeout(() => {
            setInsight(newInsight);
            setIsVisible(true);
            setIsFading(false);
          }, 300); // Wait for fade out to complete
        }
      } catch (error) {
        console.error('Failed to fetch insight:', error);
        // If Gemini fails, do not show anything
        setInsight('');
        setIsVisible(false);
        setIsFading(false);
      } finally {
        isLoadingRef.current = false;
      }
    };

    // Clear existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (isActive && geminiService.isAvailable()) {
      // Fetch first insight immediately
      fetchInsight();
      
      // Set up interval for new insights every 20 seconds
      intervalRef.current = setInterval(fetchInsight, 20000);
    } else {
      // Reset when not active
      setInsight('');
      setIsVisible(false);
      setIsFading(false);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isActive, insight]); // Include insight to avoid stale closure

  // Always render the container with fixed height to prevent layout shifts
  return (
    <Box
      style={{
        minHeight: '120px', // Fixed height for smooth transitions
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '1rem'
      }}
    >
      {isVisible && insight && (
        <Stack gap="sm" align="center" style={{ maxWidth: '500px', width: '100%' }}>
          <Image
            src="/bot.png"
            alt="AI Bot"
            w={32}
            h={32}
            fit="contain"
          />
          <Text
            fw={700} // Bold weight
            size="lg"
            ta="center"
            c="black"
            style={{
              lineHeight: 1.4,
              opacity: isFading ? 0 : 1,
              transition: 'opacity 0.3s ease-in-out',
            }}
          >
            &ldquo;{insight}&rdquo;
          </Text>
        </Stack>
      )}
    </Box>
  );
}
