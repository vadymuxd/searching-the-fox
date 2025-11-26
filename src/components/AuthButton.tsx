'use client';

import { Button, Menu, Text, Avatar } from '@mantine/core';
import { IconLogout, IconUser, IconBriefcase, IconBell } from '@tabler/icons-react';
import { signOut } from '@/lib/auth/actions';
import { useRouter } from 'next/navigation';
import { notifications } from '@mantine/notifications';
import { useAuth } from '@/lib/auth/AuthContext';

interface AuthButtonProps {
  onSignInClick: () => void;
}

export function AuthButton({ onSignInClick }: AuthButtonProps) {
  const { user, loading } = useAuth(); // Use the centralized auth context
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      const result = await signOut();
      
      if (result?.error) {
        notifications.show({
          title: 'Error',
          message: result.error,
          color: 'red',
        });
        return;
      }

      // Redirect immediately to homepage without toast
      window.location.href = '/';
    } catch (error) {
      console.error('Sign out error:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to sign out. Please try again.',
        color: 'red',
      });
    }
  };

  if (loading) {
    return null; // or a skeleton loader
  }

  if (!user) {
    return (
      <Button
        variant="subtle"
        color="blue"
        onClick={onSignInClick}
        size="sm"
      >
        Sign In
      </Button>
    );
  }

  // Extract first name or use email
  const displayName = user.email?.split('@')[0] || 'User';

  return (
    <Menu shadow="md" width={200}>
      <Menu.Target>
        <Button
          variant="subtle"
          color="blue"
          size="sm"
          leftSection={<Avatar size="sm" radius="xl" color="blue">{displayName[0].toUpperCase()}</Avatar>}
        >
          {displayName}
        </Button>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Label>Account</Menu.Label>
        <Menu.Item leftSection={<IconUser size={14} />} disabled>
          <Text size="xs" c="dimmed">{user.email}</Text>
        </Menu.Item>
        <Menu.Divider />
        <Menu.Item
          leftSection={<IconBriefcase size={14} />}
          onClick={() => router.push('/results')}
        >
          Jobs
        </Menu.Item>
        <Menu.Item
          leftSection={<IconBell size={14} />}
          onClick={() => router.push('/notifications')}
        >
          Notifications
        </Menu.Item>
        <Menu.Item
          leftSection={<IconLogout size={14} />}
          color="red"
          onClick={handleSignOut}
        >
          Sign Out
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
