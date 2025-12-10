'use client';

import { useState, useRef, useEffect } from 'react';
import { Button, Menu, rem } from '@mantine/core';
import { IconChevronDown } from '@tabler/icons-react';
import { JobStatus } from '@/types/supabase';
import { useAuth } from '@/lib/auth/AuthContext';

interface MoveToButtonProps {
  selectedJobs: Array<{ userJobId: string; title: string; company: string }>;
  onStatusUpdate: () => void;
  disabled?: boolean;
  onAuthRequired?: () => void;
  onJobsMoved?: () => void; // Callback after jobs are successfully moved
  onOperationStart?: (operationId: string) => void; // Callback when operation starts
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

export function MoveToButton({ selectedJobs, onStatusUpdate, disabled = false, onAuthRequired, onJobsMoved, onOperationStart }: MoveToButtonProps) {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const isProcessingRef = useRef(false);

  // Listen for operation completion
  useEffect(() => {
    const handleOperationComplete = () => {
      setLoading(false);
      isProcessingRef.current = false;
      onStatusUpdate();
      onJobsMoved?.();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('jobOperationComplete', handleOperationComplete);
      return () => {
        window.removeEventListener('jobOperationComplete', handleOperationComplete);
      };
    }
  }, [onStatusUpdate, onJobsMoved]);

  const startOperation = async (
    jobsToProcess: Array<{ userJobId: string; title: string; company: string }>,
    operationType: 'status-change' | 'remove',
    newStatus?: JobStatus,
    statusLabel?: string
  ) => {
    if (!user || isProcessingRef.current) return;

    isProcessingRef.current = true;
    setLoading(true);

    try {
      // Use server-side bulk update API for better performance
      // This continues even if browser is closed
      const response = await fetch('/api/jobs/bulk-update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userJobIds: jobsToProcess.map(j => j.userJobId),
          targetStatus: newStatus,
          operationType,
          userId: user.id,
        }),
        // keepalive ensures request completes even if user navigates away
        keepalive: true,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Bulk update failed');
      }

      console.log('[MoveToButton] Bulk update completed:', result);

      // Show success notification
      const { notifications } = await import('@mantine/notifications');
      const { IconCheck } = await import('@tabler/icons-react');
      
      notifications.show({
        title: operationType === 'remove' ? 'Jobs Removed' : 'Jobs Updated',
        message: result.message || `${result.successCount} job(s) updated successfully`,
        color: result.failedCount > 0 ? 'yellow' : 'green',
        icon: IconCheck ? <IconCheck size={16} /> : undefined,
        autoClose: 3000,
      });

      // Trigger UI updates
      onStatusUpdate();
      onJobsMoved?.();

    } catch (error) {
      console.error('[MoveToButton] Error in bulk operation:', error);
      
      const { notifications } = await import('@mantine/notifications');
      const { IconAlertCircle } = await import('@tabler/icons-react');
      
      notifications.show({
        title: 'Update Failed',
        message: error instanceof Error ? error.message : 'Failed to update jobs',
        color: 'red',
        icon: IconAlertCircle ? <IconAlertCircle size={16} /> : undefined,
        autoClose: 5000,
      });
    } finally {
      setLoading(false);
      isProcessingRef.current = false;
    }
  };

  const handleStatusChange = async (newStatus: JobStatus) => {
    if (selectedJobs.length === 0 || !user) return;

    const statusLabel = STATUS_OPTIONS.find(s => s.value === newStatus)?.label;
    await startOperation(selectedJobs, 'status-change', newStatus, statusLabel);
  };

  const handleRemoveJobs = async () => {
    if (selectedJobs.length === 0 || !user) return;

    await startOperation(selectedJobs, 'remove', undefined, 'Removed');
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