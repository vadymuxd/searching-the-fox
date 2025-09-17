'use client';

import { useState } from 'react';
import { Image, Avatar, rem } from '@mantine/core';
import { IconBuilding } from '@tabler/icons-react';

interface CompanyLogoProps {
  companyName: string;
  logoUrl?: string;
  size?: number;
}

export function CompanyLogo({ companyName, logoUrl, size = 40 }: CompanyLogoProps) {
  const [currentSrc, setCurrentSrc] = useState(logoUrl);
  const [fallbackIndex, setFallbackIndex] = useState(0);

  // Generate fallback URLs in order of preference
  const generateFallbackUrls = (company: string) => {
    const cleanCompany = company.toLowerCase().replace(/[^a-z0-9]/g, '');
    const companyDomain = company.toLowerCase().replace(/\s+/g, '');
    
    return [
      logoUrl, // Original URL first
      `https://logo.clearbit.com/${companyDomain}.com`, // Clearbit API
      `https://logo.clearbit.com/${cleanCompany}.com`,
      `https://logo.clearbit.com/${company.toLowerCase().replace(/\s+/g, '-')}.com`,
      `https://img.logo.dev/${companyDomain}.com?token=pk_X-1ZO13hT3iEkUUylGIShw`, // Logo.dev
    ].filter(Boolean);
  };

  const fallbackUrls = generateFallbackUrls(companyName);

  const handleError = () => {
    const nextIndex = fallbackIndex + 1;
    if (nextIndex < fallbackUrls.length) {
      setCurrentSrc(fallbackUrls[nextIndex]);
      setFallbackIndex(nextIndex);
    } else {
      // All fallbacks failed, show avatar
      setCurrentSrc(undefined);
    }
  };

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
