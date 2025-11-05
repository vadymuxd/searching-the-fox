'use client';

import { useState, useRef, useEffect } from 'react';
import { Button, Menu, rem } from '@mantine/core';
import { IconChevronDown } from '@tabler/icons-react';
import { JobStatus } from '@/types/supabase';
import { useAuth } from '@/lib/auth/AuthContext';
import { jobOperationStorage } from '@/lib/localStorage';
import { processJobOperation } from '@/lib/jobOperationProcessor';

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

    // Create new operation state
    const operationId = `${operationType}-${Date.now()}`;
    const state = {
      operationId,
      userId: user.id,
      operationType,
      targetStatus: newStatus,
      targetStatusLabel: statusLabel,
      jobs: jobsToProcess.map(j => ({ ...j, jobId: j.userJobId })),
      processedJobIds: [],
      startedAt: Date.now(),
      lastUpdatedAt: Date.now(),
      completed: false,
      successCount: 0,
      failedCount: 0,
    };
    
    jobOperationStorage.saveOperation(state);
    onOperationStart?.(operationId);

    // Start processing using the global processor (fire and forget - don't block UI)
    processJobOperation(user.id).then((success) => {
      if (success) {
        // Operation completed successfully
        onStatusUpdate();
        onJobsMoved?.();
      }
      setLoading(false);
      isProcessingRef.current = false;
    }).catch((error) => {
      console.error('Error starting job operation:', error);
      setLoading(false);
      isProcessingRef.current = false;
    });
    
    // Don't block - return immediately so user can navigate
    // The operation will continue in the background via the global processor
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