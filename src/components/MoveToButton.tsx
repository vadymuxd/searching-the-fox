'use client';

import { useState } from 'react';
import { Button, Menu, rem } from '@mantine/core';
import { IconChevronDown, IconCheck } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { updateJobStatus, removeUserJob } from '@/lib/db/jobService';
import { JobStatus } from '@/types/supabase';
import { useAuth } from '@/lib/auth/AuthContext';

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

  const handleStatusChange = async (newStatus: JobStatus) => {
    if (selectedJobs.length === 0) return;

    setLoading(true);
    
    try {
      // Update all selected jobs
      const updatePromises = selectedJobs.map(job => 
        updateJobStatus(job.userJobId, newStatus)
      );
      
      const results = await Promise.all(updatePromises);
      
      // Check if all updates were successful
      const failedUpdates = results.filter(result => !result.success);
      
      if (failedUpdates.length === 0) {
        // All updates successful
        notifications.show({
          title: 'Jobs Updated',
          message: `Successfully moved ${selectedJobs.length} job${selectedJobs.length > 1 ? 's' : ''} to "${STATUS_OPTIONS.find(s => s.value === newStatus)?.label}"`,
          color: 'green',
          icon: <IconCheck size={16} />,
        });
        
        // Refresh the page to show updated status
        onStatusUpdate();
      } else {
        // Some updates failed
        notifications.show({
          title: 'Partial Update',
          message: `${results.filter(r => r.success).length} jobs updated successfully, ${failedUpdates.length} failed`,
          color: 'yellow',
        });
        
        // Still refresh to show partial updates
        onStatusUpdate();
      }
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
    if (selectedJobs.length === 0) return;

    setLoading(true);
    
    try {
      // Remove all selected jobs
      const removePromises = selectedJobs.map(job => 
        removeUserJob(job.userJobId)
      );
      
      const results = await Promise.all(removePromises);
      
      // Check if all removals were successful
      const failedRemovals = results.filter(result => !result.success);
      
      if (failedRemovals.length === 0) {
        // All removals successful
        notifications.show({
          title: 'Jobs Removed',
          message: `Successfully removed ${selectedJobs.length} job${selectedJobs.length > 1 ? 's' : ''} from your list`,
          color: 'green',
          icon: <IconCheck size={16} />,
        });
        
        // Refresh the page to show updated list
        onStatusUpdate();
      } else {
        // Some removals failed
        notifications.show({
          title: 'Partial Removal',
          message: `${results.filter(r => r.success).length} jobs removed successfully, ${failedRemovals.length} failed`,
          color: 'yellow',
        });
        
        // Still refresh to show partial updates
        onStatusUpdate();
      }
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