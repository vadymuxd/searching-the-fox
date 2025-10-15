'use client';

import { useState } from 'react';
import { Button, Menu, rem } from '@mantine/core';
import { IconChevronDown, IconCheck } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { updateJobStatus } from '@/lib/db/jobService';
import { JobStatus } from '@/types/supabase';

interface MoveToButtonProps {
  selectedJobs: Array<{ userJobId: string; title: string; company: string }>;
  onStatusUpdate: () => void;
  disabled?: boolean;
}

const STATUS_OPTIONS: Array<{ value: JobStatus; label: string }> = [
  { value: 'new', label: 'New' },
  { value: 'interested', label: 'Interested' },
  { value: 'applied', label: 'Applied' },
  { value: 'progressed', label: 'Progressed' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'archived', label: 'Archived' },
];

export function MoveToButton({ selectedJobs, onStatusUpdate, disabled = false }: MoveToButtonProps) {
  const [loading, setLoading] = useState(false);

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
        {STATUS_OPTIONS.map((status) => (
          <Menu.Item
            key={status.value}
            onClick={() => handleStatusChange(status.value)}
          >
            {status.label}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}