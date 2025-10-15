'use client';

import { Button, Menu, Text, Avatar } from '@mantine/core';
import { IconLogout, IconUser } from '@tabler/icons-react';
import { signOut } from '@/lib/auth/actions';
import { notifications } from '@mantine/notifications';
import { useAuth } from '@/lib/auth/AuthContext';

interface AuthButtonProps {
  onSignInClick: () => void;
}

export function AuthButton({ onSignInClick }: AuthButtonProps) {
  const { user, loading } = useAuth(); // Use the centralized auth context

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

      notifications.show({
        title: 'Signed out',
        message: 'You have been signed out successfully.',
        color: 'blue',
        autoClose: 1000,
      });

      // Force browser refresh after sign out to clear all state
      setTimeout(() => {
        window.location.href = '/';
      }, 1000);
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
