'use client';

import { useState } from 'react';
import { Button } from '@mantine/core';
import { IconDatabaseImport, IconCheck } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { saveJobsToDatabase } from '@/lib/db/jobService';
import { Job } from '@/types/job';

interface MoveToDbButtonProps {
  jobs: Job[];
  userId: string;
  onComplete?: () => void;
}

export function MoveToDbButton({ jobs, userId, onComplete }: MoveToDbButtonProps) {
  const [loading, setLoading] = useState(false);
  const [moved, setMoved] = useState(false);

  const handleMoveToDb = async () => {
    if (jobs.length === 0) {
      notifications.show({
        title: 'No jobs to move',
        message: 'There are no jobs in local storage to move.',
        color: 'orange',
      });
      return;
    }

    setLoading(true);

    try {
      const result = await saveJobsToDatabase(jobs, userId);

      if (result.success) {
        setMoved(true);
        notifications.show({
          title: 'Success!',
          message: `${result.jobsSaved} job${result.jobsSaved !== 1 ? 's' : ''} moved to your database.`,
          color: 'green',
          icon: <IconCheck size={16} />,
        });

        // Call onComplete callback if provided
        if (onComplete) {
          onComplete();
        }
      } else {
        notifications.show({
          title: 'Error',
          message: result.error || 'Failed to move jobs to database.',
          color: 'red',
        });
      }
    } catch (error) {
      console.error('Error moving jobs to database:', error);
      notifications.show({
        title: 'Error',
        message: 'An unexpected error occurred. Please try again.',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  if (moved) {
    return (
      <Button
        variant="light"
        color="green"
        leftSection={<IconCheck size={16} />}
        disabled
      >
        Jobs Saved to Database
      </Button>
    );
  }

  return (
    <Button
      variant="filled"
      color="blue"
      leftSection={<IconDatabaseImport size={16} />}
      onClick={handleMoveToDb}
      loading={loading}
    >
      Move Local Data to DB
    </Button>
  );
}
