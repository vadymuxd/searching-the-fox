'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { useRouter } from 'next/navigation';
import { Container, Paper, Title, Text, Stack, Loader, Center } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Header } from '@/components/Header';
import { Toggle } from '@/components/Toggle';

export default function NotificationsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [emailNotifications, setEmailNotifications] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
      return;
    }

    if (user) {
      fetchNotificationSettings();
    }
  }, [user, authLoading, router]);

  const fetchNotificationSettings = async () => {
    try {
      const response = await fetch('/api/notifications/settings');
      const data = await response.json();

      if (response.ok) {
        setEmailNotifications(data.emailNotificationsEnabled || false);
      } else {
        notifications.show({
          title: 'Error',
          message: 'Failed to load notification settings',
          color: 'red',
        });
      }
    } catch (error) {
      console.error('Error fetching notification settings:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to load notification settings',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (checked: boolean) => {
    setSaving(true);
    
    try {
      const response = await fetch('/api/notifications/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          emailNotificationsEnabled: checked,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setEmailNotifications(checked);
        notifications.show({
          title: 'Success',
          message: checked 
            ? 'Email notifications enabled' 
            : 'Email notifications disabled',
          color: 'green',
        });
      } else {
        notifications.show({
          title: 'Error',
          message: data.error || 'Failed to update settings',
          color: 'red',
        });
      }
    } catch (error) {
      console.error('Error updating notification settings:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to update settings',
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <>
        <Header onSignInClick={() => {}} />
        <Container size="sm" mt="xl">
          <Center style={{ minHeight: '50vh' }}>
            <Loader size="lg" />
          </Center>
        </Container>
      </>
    );
  }

  return (
    <>
      <Header onSignInClick={() => {}} />
      <Container size="sm" mt="xl">
        <Paper shadow="sm" p="xl" withBorder>
          <Stack gap="lg">
            <div>
              <Title order={2} mb="xs">
                Notifications
              </Title>
            </div>

            <Paper withBorder p="md" bg="gray.0">
              <Stack gap="sm">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <Text fw={500} size="sm">
                      New Jobs Email
                    </Text>
                    <Text size="xs" c="dimmed" mt={4}>
                      You will receive emails twice per day around 9-10am and around 3-4pm if new jobs matching your job title keywords are added to Indeed or Linkedin
                    </Text>
                  </div>
                  <Toggle
                    checked={emailNotifications}
                    onChange={(event) => handleToggle(event.currentTarget.checked)}
                    disabled={saving}
                    size="md"
                  />
                </div>

                {emailNotifications && (
                  <Text size="xs" c="blue" mt="xs">
                    ✓ You will receive email notifications for new jobs
                  </Text>
                )}
              </Stack>
            </Paper>
          </Stack>
        </Paper>
      </Container>
    </>
  );
}
