'use client';

import { useState } from 'react';
import { Modal, TextInput, PasswordInput, Button, Stack, Text, Divider, Group, Anchor } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconBrandGoogle, IconCheck, IconX } from '@tabler/icons-react';
import { signUp, signIn, resetPassword } from '@/lib/auth/actions';
import { createClient } from '@/lib/supabase/client';

type AuthMode = 'signin' | 'signup' | 'reset';

interface AuthModalProps {
  opened: boolean;
  onClose: () => void;
  hasSearchResults?: boolean; // True if user has performed a search
  customTitle?: string; // Custom title override
  customMessage?: string; // Custom message override
}

export function AuthModal({ opened, onClose, hasSearchResults = false, customTitle, customMessage }: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData();
    formData.append('email', email);
    formData.append('password', password);

    try {
      let result;

      if (mode === 'signup') {
        result = await signUp(formData);
        if (!result.error) {
          // Don't show toast - close modal and show email confirmation screen
          onClose();
          // Trigger the email confirmation state in parent component
          window.dispatchEvent(new CustomEvent('showEmailConfirmation', { 
            detail: { email } 
          }));
        }
      } else if (mode === 'signin') {
        result = await signIn(formData);
        if (!result.error) {
          onClose();
          // Hard redirect to results page to ensure fresh data load
          window.location.href = '/results';
        } else if (result.error.includes('Email not confirmed')) {
          // Handle unconfirmed email case - close modal and show confirmation screen
          notifications.show({
            title: 'Email not confirmed',
            message: 'Please check your email and confirm your account to sign in.',
            color: 'orange',
            icon: <IconCheck size={16} />,
          });
          onClose();
          // Trigger the email confirmation state in parent component
          window.dispatchEvent(new CustomEvent('showEmailConfirmation', { 
            detail: { email } 
          }));
        }
      } else if (mode === 'reset') {
        result = await resetPassword(formData);
        if (!result.error) {
          notifications.show({
            title: 'Password reset email sent',
            message: 'Check your inbox for password reset instructions.',
            color: 'blue',
            icon: <IconCheck size={16} />,
          });
          setMode('signin');
        }
      }

      if (result?.error) {
        notifications.show({
          title: 'Error',
          message: result.error,
          color: 'red',
          icon: <IconX size={16} />,
        });
      }
    } catch {
      notifications.show({
        title: 'Error',
        message: 'Something went wrong. Please try again.',
        color: 'red',
        icon: <IconX size={16} />,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthSignIn = async (provider: 'google' | 'github' | 'linkedin_oidc') => {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      notifications.show({
        title: 'Error',
        message: error.message,
        color: 'red',
        icon: <IconX size={16} />,
      });
    }
  };

  const getTitle = () => {
    if (customTitle) return customTitle;
    if (mode === 'signup') return 'Create Account';
    if (mode === 'reset') return 'Reset Password';
    return 'Sign In';
  };

  const getMessage = () => {
    if (customMessage) return customMessage;
    if (hasSearchResults) {
      return 'Sign in to save your search results and track job applications across devices.';
    }
    return 'Sign in to save jobs, track applications, and access your search history.';
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      centered
      size="md"
      withCloseButton={false}
    >
      <Stack gap="md">
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600 }}>
          {getTitle()}
        </h1>
        
        <Text size="sm" c="dimmed">
          {getMessage()}
        </Text>

        {/* OAuth Providers */}
        {mode !== 'reset' && (
          <>
            <Stack gap="xs">
              <Button
                variant="default"
                leftSection={<IconBrandGoogle size={20} />}
                onClick={() => handleOAuthSignIn('google')}
                fullWidth
              >
                Continue with Google
              </Button>
            </Stack>

            <Divider label="or" labelPosition="center" />
          </>
        )}

        {/* Email/Password Form */}
        <form onSubmit={handleSubmit}>
          <Stack gap="md">
            <TextInput
              label="Email"
              placeholder="your@email.com"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
              disabled={loading}
            />

            {mode !== 'reset' && (
              <PasswordInput
                label="Password"
                placeholder="Your password"
                required
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
                disabled={loading}
              />
            )}

            <Button type="submit" loading={loading} fullWidth>
              {mode === 'signup' && 'Create Account'}
              {mode === 'signin' && 'Sign In'}
              {mode === 'reset' && 'Send Reset Link'}
            </Button>
          </Stack>
        </form>

        {/* Mode Switchers */}
        <Stack gap="xs">
          {mode === 'signin' && (
            <>
              <Group justify="center" gap="xs">
                <Text size="sm" c="dimmed">
                  Don&apos;t have an account?
                </Text>
                <Anchor
                  size="sm"
                  component="button"
                  type="button"
                  onClick={() => setMode('signup')}
                >
                  Sign up
                </Anchor>
              </Group>
              <Group justify="center">
                <Anchor
                  size="sm"
                  component="button"
                  type="button"
                  onClick={() => setMode('reset')}
                >
                  Forgot password?
                </Anchor>
              </Group>
            </>
          )}

          {mode === 'signup' && (
            <Group justify="center" gap="xs">
              <Text size="sm" c="dimmed">
                Already have an account?
              </Text>
              <Anchor
                size="sm"
                component="button"
                type="button"
                onClick={() => setMode('signin')}
              >
                Sign in
              </Anchor>
            </Group>
          )}

          {mode === 'reset' && (
            <Group justify="center" gap="xs">
              <Anchor
                size="sm"
                component="button"
                type="button"
                onClick={() => setMode('signin')}
              >
                Back to sign in
              </Anchor>
            </Group>
          )}
        </Stack>
      </Stack>
    </Modal>
  );
}
