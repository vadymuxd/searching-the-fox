'use client';

import { useState } from 'react';
import { Container, Stack, Text, Button, Box } from '@mantine/core';
import { IconAlertCircle, IconCheck } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { createClient } from '@/lib/supabase/client';
import { Header } from '@/components/Header';

export default function VerifyEmailPage() {
  const [resendingEmail, setResendingEmail] = useState(false);

  const handleResendConfirmation = async () => {
    // Get email from URL params or localStorage if available
    const params = new URLSearchParams(window.location.search);
    const email = params.get('email');
    
    if (!email) {
      notifications.show({
        title: 'Error',
        message: 'No email address found. Please try signing up again.',
        color: 'red',
        icon: <IconAlertCircle size={16} />,
      });
      return;
    }

    if (resendingEmail) return;
    
    setResendingEmail(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email
      });
      
      if (error) {
        notifications.show({
          title: 'Failed to resend email',
          message: error.message,
          color: 'red',
          icon: <IconAlertCircle size={16} />,
        });
      } else {
        notifications.show({
          title: 'Email sent!',
          message: 'We\'ve sent another confirmation email to your inbox.',
          color: 'green',
          icon: <IconCheck size={16} />,
        });
      }
    } catch {
      notifications.show({
        title: 'Error',
        message: 'Failed to resend confirmation email.',
        color: 'red',
        icon: <IconAlertCircle size={16} />,
      });
    } finally {
      setResendingEmail(false);
    }
  };

  // Get email from URL params
  const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const email = params.get('email');

  return (
    <>
      <Header onSignInClick={() => {}} />
      <Box style={{ backgroundColor: '#f8f9fa', minHeight: '100vh', paddingTop: '80px' }}>
        <Container size="sm">
          <Stack gap="lg" align="center" ta="center">
            <Stack gap="md" align="center">
              <Text size="xl" fw={600} c="blue">
                Check Your Email
              </Text>
              
              {email ? (
                <Text size="md" c="dimmed" maw={400}>
                  We&apos;ve sent a verification email to <strong>{email}</strong>. 
                  Please check your email and click the verification link to activate your account.
                </Text>
              ) : (
                <Text size="md" c="dimmed" maw={400}>
                  We&apos;ve sent a verification email to your inbox. 
                  Please check your email and click the verification link to activate your account.
                </Text>
              )}
              
              <Text size="sm" c="dimmed">
                Don&apos;t see the email? Check your spam folder or try resending.
              </Text>
              
              {email && (
                <Button 
                  variant="outline" 
                  size="sm"
                  loading={resendingEmail}
                  onClick={handleResendConfirmation}
                >
                  Resend Verification Email
                </Button>
              )}
              
              <Text size="xs" c="dimmed" maw={400}>
                Once you&apos;ve verified your email, you can sign in and access all features.
              </Text>
            </Stack>
          </Stack>
        </Container>
      </Box>
    </>
  );
}