'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Tabs, Container, Box } from '@mantine/core';
import { useAuth } from '@/lib/auth/AuthContext';

// Job status types based on database enum
export type JobStatus = 'new' | 'interested' | 'applied' | 'progressed' | 'rejected' | 'archived';

// Tab configuration
const JOB_TABS = [
  { value: 'new', label: 'New', path: '/results/new' },
  { value: 'interested', label: 'Interested', path: '/results/interested' },
  { value: 'applied', label: 'Applied', path: '/results/applied' },
  { value: 'progressed', label: 'In Progress', path: '/results/progressed' },
  { value: 'rejected', label: 'Rejected', path: '/results/rejected' },
  { value: 'archived', label: 'Archived', path: '/results/archived' },
];

interface TabNavigationProps {
  onAuthRequired?: () => void;
}

export function TabNavigation({ onAuthRequired }: TabNavigationProps = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();

  // Get the current active tab based on pathname
  const getCurrentTab = () => {
    const currentTab = JOB_TABS.find(tab => tab.path === pathname);
    return currentTab?.value || 'new';
  };

  const handleTabChange = (value: string | null) => {
    if (!value) return;
    
    // If user is not authenticated, trigger auth modal instead of navigation
    if (!user) {
      onAuthRequired?.();
      return;
    }
    
    const tab = JOB_TABS.find(t => t.value === value);
    if (tab) {
      router.push(tab.path);
    }
  };

  return (
    <Box style={{ backgroundColor: '#F8F9FA', paddingTop: '32px' }}>
      <Container size="xl">
        <Tabs 
          value={getCurrentTab()} 
          onChange={handleTabChange}
          variant="unstyled"
          styles={{
            list: {
              borderBottom: 'none',
              display: 'flex',
              alignItems: 'center',
            },
            tab: {
              border: 'none',
              backgroundColor: 'transparent',
              display: 'flex',
              alignItems: 'center',
              '&:hover': {
                backgroundColor: 'transparent',
              }
            }
          }}
        >
          <Tabs.List>
            {JOB_TABS.map((tab, index) => {
              const isActive = pathname === tab.path;
              const isFirstTab = index === 0; // Check if it's the first tab ("New")
              const isLastTab = index === JOB_TABS.length - 1;
              
              return (
                <React.Fragment key={tab.value}>
                  <Tabs.Tab 
                    value={tab.value}
                    style={{
                      color: isActive ? '#000000' : '#BEBEC1',
                      fontWeight: 'bold',
                      fontSize: '1.25rem',
                      paddingLeft: isFirstTab ? '0px' : undefined, // Remove left padding for first tab
                    }}
                  >
                    {tab.label}
                  </Tabs.Tab>
                  {!isLastTab && (
                    <span style={{ 
                      color: '#BEBEC1', 
                      fontSize: '0.625rem', // Half of 1.25rem
                      fontWeight: 'bold',
                      padding: '0 8px',
                      width: '1px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: 0.5
                    }}>
                      |
                    </span>
                  )}
                </React.Fragment>
              );
            })}
          </Tabs.List>
        </Tabs>
      </Container>
    </Box>
  );
}