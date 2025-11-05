'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { processJobOperation } from '@/lib/jobOperationProcessor';

interface JobOperationManagerProps {
  onOperationComplete?: () => void;
}

/**
 * Component that checks for and resumes ongoing job operations from localStorage
 * Should be mounted once at the top level of JobsPageContent
 */
export function JobOperationManager({ onOperationComplete }: JobOperationManagerProps) {
  const { user } = useAuth();
  const isCheckingRef = useRef(false);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Check for operations on mount and periodically
    if (!user) {
      return;
    }

    const checkAndResumeOperation = () => {
      if (isCheckingRef.current) {
        return;
      }
      
      isCheckingRef.current = true;
      console.log('JobOperationManager: Checking for operations to resume');
      
      // Fire and forget - don't await, let it run in background
      processJobOperation(user.id).then((success) => {
        if (success) {
          console.log('JobOperationManager: Operation completed successfully');
          onOperationComplete?.();
        }
        isCheckingRef.current = false;
      }).catch((error) => {
        console.error('JobOperationManager: Error processing operation', error);
        isCheckingRef.current = false;
      });
    };

    // Initial check after a small delay
    const timer = setTimeout(() => {
      checkAndResumeOperation();
    }, 100);

    // Set up periodic checking every 2 seconds to ensure operation continues
    // This helps recover from any interruptions
    checkIntervalRef.current = setInterval(() => {
      const operation = require('@/lib/localStorage').jobOperationStorage.loadOperation();
      if (operation && !operation.completed && operation.userId === user.id && !isCheckingRef.current) {
        console.log('JobOperationManager: Periodic check found incomplete operation, resuming');
        checkAndResumeOperation();
      }
    }, 2000);

    return () => {
      clearTimeout(timer);
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
      isCheckingRef.current = false;
    };
  }, [user, onOperationComplete]);

  // Listen for operation completion events
  useEffect(() => {
    const handleComplete = () => {
      console.log('JobOperationManager: Received completion event');
      onOperationComplete?.();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('jobOperationComplete', handleComplete);
      return () => {
        window.removeEventListener('jobOperationComplete', handleComplete);
      };
    }
  }, [onOperationComplete]);

  // This component doesn't render anything
  return null;
}
