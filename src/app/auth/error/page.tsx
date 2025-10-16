'use client';

import { useSearchParams } from 'next/navigation';
import { Container, Stack, Text, Box, Paper, Button } from '@mantine/core';
import Image from 'next/image';
import Link from 'next/link';

export default function AuthErrorPage() {
  const searchParams = useSearchParams();
  const message = searchParams.get('message') || 'An error occurred during authentication';

  return (
    <Box style={{ backgroundColor: '#f8f9fa', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Container size="sm">
        <Paper p="xl" radius="md" style={{ textAlign: 'center' }}>
          <Stack gap="lg" align="center">
            {/* Logo */}
            <Box style={{ width: '100px', height: '75px' }}>
              <Image 
                src="/Searching-The-Fox.svg"
                alt="Searching The Fox logo"
                width={100}
                height={75}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </Box>
            
            {/* Company Name */}
            <Text 
              style={{ 
                color: '#888',
                fontSize: '1rem',
                fontWeight: 400,
                fontFamily: 'inherit',
              }}
            >
              searching the fox
            </Text>

            {/* Error Message */}
            <Stack gap="md" align="center">
              <Text size="xl" fw={600} c="red">
                ✗ Authentication Error
              </Text>
              <Text size="md" c="dimmed" style={{ maxWidth: '400px' }}>
                {message}
              </Text>
              <Text size="sm" c="dimmed">
                This could happen if the confirmation link has expired or has already been used.
              </Text>
            </Stack>

            {/* Action Button */}
            <Button 
              component={Link} 
              href="/" 
              variant="filled" 
              color="blue"
              size="md"
            >
              Return to Homepage
            </Button>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}