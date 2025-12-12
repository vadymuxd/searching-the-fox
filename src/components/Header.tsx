'use client';

import { Box, Container, Group } from '@mantine/core';
import Image from 'next/image';
import { AuthButton } from './AuthButton';
import { useRouter } from 'next/navigation';

interface HeaderProps {
  onSignInClick: () => void;
}

export function Header({ onSignInClick }: HeaderProps) {
  const router = useRouter();

  return (
    <Box
      component="header"
      style={{
        backgroundColor: '#F8F9FA',
        borderBottom: '1px solid #DEE2E6',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}
    >
      <Container size="xl" py="md">
        <Group justify="space-between" align="center">
          {/* Logo */}
          <Box
            style={{ cursor: 'pointer' }}
            onClick={() => router.push('/results')}
          >
            <Image
              src="/favicon.png"
              alt="Searching The Fox"
              width={40}
              height={40}
              priority
            />
          </Box>
          
          {/* Auth Button */}
          <AuthButton onSignInClick={onSignInClick} />
        </Group>
      </Container>
    </Box>
  );
}
