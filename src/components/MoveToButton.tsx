'use client';

import { useState, useRef } from 'react';
import { Button, Menu, rem } from '@mantine/core';
import { IconChevronDown, IconCheck, IconAlertCircle } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { updateJobStatus, removeUserJob } from '@/lib/db/jobService';
import { JobStatus } from '@/types/supabase';
import { useAuth } from '@/lib/auth/AuthContext';
import { jobsDataManager } from '@/lib/jobsDataManager';
import { ProgressToast } from './ProgressToast';

interface MoveToButtonProps {
  selectedJobs: Array<{ userJobId: string; title: string; company: string }>;
  onStatusUpdate: () => void;
  disabled?: boolean;
  onAuthRequired?: () => void;
}

const STATUS_OPTIONS: Array<{ value: JobStatus; label: string }> = [
  { value: 'new', label: 'New' },
  { value: 'interested', label: 'Interested' },
  { value: 'applied', label: 'Applied' },
  { value: 'progressed', label: 'Progressed' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'archived', label: 'Archived' },
];

const MENU_OPTIONS = [
  ...STATUS_OPTIONS,
  { value: 'removed', label: 'Removed' }
] as const;

export function MoveToButton({ selectedJobs, onStatusUpdate, disabled = false, onAuthRequired }: MoveToButtonProps) {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const notificationIdRef = useRef<string | null>(null);

  const handleStatusChange = async (newStatus: JobStatus) => {
    if (selectedJobs.length === 0 || !user) return;

    setLoading(true);
    const statusLabel = STATUS_OPTIONS.find(s => s.value === newStatus)?.label;
    let successCount = 0;
    let failedUpdates = 0;
    
    try {
      // Show initial progress notification
      notificationIdRef.current = notifications.show({
        message: <ProgressToast current={0} total={selectedJobs.length} targetStatus={statusLabel} />,
        autoClose: false,
        color: 'white',
      });

      // Update jobs sequentially to track progress
      const results = [];
      for (let i = 0; i < selectedJobs.length; i++) {
        const job = selectedJobs[i];
        const result = await updateJobStatus(job.userJobId, newStatus);
        results.push(result);

        if (result.success) {
          successCount++;
        } else {
          failedUpdates++;
        }

        // Update notification with current progress
        if (notificationIdRef.current) {
          notifications.update({
            id: notificationIdRef.current,
            message: <ProgressToast current={successCount + failedUpdates} total={selectedJobs.length} targetStatus={statusLabel} />,
            autoClose: false,
            color: 'white',
          });
        }
      }

      // All updates done - sync cache with database
      await jobsDataManager.syncWithDatabase(user.id, undefined, true);

      // Dispatch custom event to update job counters in TabNavigation
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('jobsUpdated'));
      }

      // Show appropriate final notification
      if (failedUpdates === 0) {
        // All updates successful
        if (notificationIdRef.current) {
          notifications.update({
            id: notificationIdRef.current,
            message: <ProgressToast current={successCount} total={selectedJobs.length} targetStatus={statusLabel} isComplete />,
            title: 'Jobs Updated',
            color: 'green',
            icon: <IconCheck size={16} />,
            autoClose: 3000,
          });
        }
      } else {
        // Some updates failed
        notifications.update({
          id: notificationIdRef.current || '',
          title: 'Partial Update',
          message: `${successCount} job${successCount > 1 ? 's' : ''} updated successfully, ${failedUpdates} failed`,
          color: 'yellow',
          icon: <IconAlertCircle size={16} />,
          autoClose: 3000,
        });
      }      // Refresh the page to show updated status
      onStatusUpdate();
    } catch (error) {
      console.error('Error updating job status:', error);
      notifications.show({
        title: 'Update Failed',
        message: 'Failed to update job status. Please try again.',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveJobs = async () => {
    if (selectedJobs.length === 0 || !user) return;

    setLoading(true);
    let successCount = 0;
    let failedRemovals = 0;
    
    try {
      // Show initial progress notification
      notificationIdRef.current = notifications.show({
        message: <ProgressToast current={0} total={selectedJobs.length} targetStatus="Removed" />,
        autoClose: false,
        color: 'white',
      });

      // Remove jobs sequentially to track progress
      const results = [];
      for (let i = 0; i < selectedJobs.length; i++) {
        const job = selectedJobs[i];
        const result = await removeUserJob(job.userJobId);
        results.push(result);

        if (result.success) {
          successCount++;
        } else {
          failedRemovals++;
        }

        // Update notification with current progress
        if (notificationIdRef.current) {
          notifications.update({
            id: notificationIdRef.current,
            message: <ProgressToast current={successCount + failedRemovals} total={selectedJobs.length} targetStatus="Removed" />,
            autoClose: false,
            color: 'white',
          });
        }
      }

      // All removals done - sync cache with database
      await jobsDataManager.syncWithDatabase(user.id, undefined, true);

      // Dispatch custom event to update job counters in TabNavigation
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('jobsUpdated'));
      }

      // Show appropriate final notification
      if (failedRemovals === 0) {
        // All removals successful
        if (notificationIdRef.current) {
          notifications.update({
            id: notificationIdRef.current,
            message: <ProgressToast current={successCount} total={selectedJobs.length} targetStatus="Removed" isComplete />,
            title: 'Jobs Removed',
            color: 'green',
            icon: <IconCheck size={16} />,
            autoClose: 3000,
          });
        }
      } else {
        // Some removals failed
        notifications.update({
          id: notificationIdRef.current || '',
          title: 'Partial Removal',
          message: `${successCount} job${successCount > 1 ? 's' : ''} removed successfully, ${failedRemovals} failed`,
          color: 'yellow',
          icon: <IconAlertCircle size={16} />,
          autoClose: 3000,
        });
      }

      // Refresh the page to show updated list
      onStatusUpdate();
    } catch (error) {
      console.error('Error removing jobs:', error);
      notifications.show({
        title: 'Removal Failed',
        message: 'Failed to remove jobs. Please try again.',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMenuAction = async (action: string) => {
    // If user is not authenticated, trigger auth modal instead of performing action
    if (!user) {
      onAuthRequired?.();
      return;
    }

    if (action === 'removed') {
      await handleRemoveJobs();
    } else {
      await handleStatusChange(action as JobStatus);
    }
  };

  if (selectedJobs.length === 0) {
    return null;
  }

  return (
    <Menu shadow="md" width={200} position="bottom-end">
      <Menu.Target>
        <Button
          variant="filled"
          color="blue"
          rightSection={<IconChevronDown style={{ width: rem(16), height: rem(16) }} />}
          loading={loading}
          disabled={disabled}
          size="sm"
        >
          Move To
        </Button>
      </Menu.Target>

      <Menu.Dropdown>
        {MENU_OPTIONS.map((option) => (
          <Menu.Item
            key={option.value}
            onClick={() => handleMenuAction(option.value)}
          >
            {option.label}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}