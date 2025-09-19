
import { useState, useEffect, useRef } from 'react';
import { Text, Stack, Image, Box } from '@mantine/core';
import { getRandomJobInsight } from '../lib/randomJobInsight';

export interface LoadingInsightProps {
  isActive: boolean; // When true, start fetching insights
}

export function LoadingInsightWithIcon(props: LoadingInsightProps) {
  return (
    <>
      <Image
        src="/bot.png"
        alt="AI Bot"
        w={32}
        h={32}
        fit="contain"
        style={{ display: 'block', marginLeft: 'auto', marginRight: 'auto', marginBottom: 4 }}
      />
      <LoadingInsight {...props} />
    </>
  );
}

function LoadingInsight({ isActive }: LoadingInsightProps) {
  const [insight, setInsight] = useState<string>('');
  const [isVisible, setIsVisible] = useState(false);
  const [isFading, setIsFading] = useState(false);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Clear existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (isActive) {
      // Show first insight immediately
      const showRandomInsight = () => {
        setIsFading(true);
        setTimeout(() => {
          setInsight(getRandomJobInsight());
          setIsVisible(true);
          setIsFading(false);
        }, 300);
      };
      showRandomInsight();
      // Set up interval for new insights every 20 seconds
      intervalRef.current = setInterval(showRandomInsight, 10000);
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
  }, [isActive]);

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
  <Stack gap={6} align="center" style={{ maxWidth: '500px', width: '100%' }}>
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
