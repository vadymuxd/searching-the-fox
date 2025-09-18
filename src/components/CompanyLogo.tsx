'use client';

import { useState, useEffect } from 'react';
import { Image, Avatar, rem } from '@mantine/core';
import { IconBuilding } from '@tabler/icons-react';
import { LogoService } from '@/lib/logoService';

interface CompanyLogoProps {
  companyName: string;
  logoUrl?: string;
  size?: number;
  sourceSite?: string; // Add source site to determine logo handling strategy
}

export function CompanyLogo({ companyName, logoUrl, size = 40, sourceSite }: CompanyLogoProps) {
  const [currentSrc, setCurrentSrc] = useState<string | undefined>(logoUrl);
  const [fallbackIndex, setFallbackIndex] = useState(0);
  const [fallbackUrls, setFallbackUrls] = useState<string[]>([]);

  // Initialize fallback URLs when component mounts or company changes
  useEffect(() => {
    const urls = LogoService.generateLogoUrls(companyName, logoUrl, sourceSite);
    setFallbackUrls(urls);
    setCurrentSrc(urls[0]);
    setFallbackIndex(0);
  }, [companyName, logoUrl, sourceSite]);

  const handleError = () => {
    const nextIndex = fallbackIndex + 1;
    if (nextIndex < fallbackUrls.length) {
      setCurrentSrc(fallbackUrls[nextIndex]);
      setFallbackIndex(nextIndex);
    } else {
      // All fallbacks failed, try alternative sources asynchronously
      LogoService.fetchFromAlternativeSources(companyName).then((alternativeUrl) => {
        if (alternativeUrl) {
          setCurrentSrc(alternativeUrl);
        } else {
          // Truly no logo available, show avatar
          setCurrentSrc(undefined);
        }
      });
    }
  };

  // Cache successful logo URL
  useEffect(() => {
    if (currentSrc && fallbackIndex > 0) {
      LogoService.cacheLogoUrl(companyName, currentSrc);
    }
  }, [currentSrc, companyName, fallbackIndex]);

  if (!currentSrc) {
    return (
      <Avatar size={size} radius="sm" color="gray">
        <IconBuilding style={{ width: rem(size * 0.5), height: rem(size * 0.5) }} />
      </Avatar>
    );
  }

  return (
    <Image
      src={currentSrc}
      alt={`${companyName} logo`}
      w={size}
      h={size}
      radius="sm"
      onError={handleError}
      fallbackSrc={undefined} // We handle fallbacks manually
    />
  );
}
