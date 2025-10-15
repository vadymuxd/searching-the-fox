'use client';

import { useState, useEffect } from 'react';
import { Button, Menu, Text, Avatar } from '@mantine/core';
import { IconLogout, IconUser } from '@tabler/icons-react';
import { createClient } from '@/lib/supabase/client';
import { signOut } from '@/lib/auth/actions';
import { notifications } from '@mantine/notifications';
import type { User } from '@supabase/supabase-js';

interface AuthButtonProps {
  onSignInClick: () => void;
}

export function AuthButton({ onSignInClick }: AuthButtonProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    // Get initial session
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

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
      });

      // No need to reload - auth state listener will handle cleanup
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
