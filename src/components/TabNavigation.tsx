'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';
import { Tabs, Container, Box } from '@mantine/core';
import { useMantineTheme } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { useRef, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';

// Job status types based on database enum
export type JobStatus = 'new' | 'interested' | 'applied' | 'progressed' | 'rejected' | 'archived';

// Tab configuration
const JOB_TABS = [
  { value: 'new', label: 'New' },
  { value: 'interested', label: 'Interested' },
  { value: 'applied', label: 'Applied' },
  { value: 'progressed', label: 'Progressed' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'archived', label: 'Archived' },
];

interface TabNavigationProps {
  onAuthRequired?: () => void;
  onTabChange?: (status: JobStatus) => void;
}

export function TabNavigation({ onAuthRequired, onTabChange, backgroundColor }: TabNavigationProps & { backgroundColor?: string } = {}) {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [jobCounts, setJobCounts] = useState<Record<JobStatus, number>>({
    new: 0,
    interested: 0,
    applied: 0,
    progressed: 0,
    rejected: 0,
    archived: 0,
  });

  // Get the current active tab from query parameters
  const getCurrentTab = () => {
    const status = searchParams.get('status');
    return status || 'new';
  };

  // Load job counts from cache
  useEffect(() => {
    const loadJobCounts = async () => {
      try {
        if (typeof window === 'undefined') return;

        if (user) {
          // For authenticated users, get counts from jobsDataManager cache
          const cachedData = localStorage.getItem('searchingTheFox_cachedJobs');
          if (cachedData) {
            const parsedData = JSON.parse(cachedData);
            setJobCounts({
              new: parsedData.new?.length || 0,
              interested: parsedData.interested?.length || 0,
              applied: parsedData.applied?.length || 0,
              progressed: parsedData.progressed?.length || 0,
              rejected: parsedData.rejected?.length || 0,
              archived: parsedData.archived?.length || 0,
            });
          }
        } else {
          // For guest users, get count from localStorage (searchResults)
          const guestData = localStorage.getItem('searchingTheFox_searchResults');
          if (guestData) {
            const parsedData = JSON.parse(guestData);
            const jobs = parsedData.jobs || [];
            setJobCounts({
              new: jobs.length,
              interested: 0,
              applied: 0,
              progressed: 0,
              rejected: 0,
              archived: 0,
            });
          }
        }
      } catch (error) {
        console.error('Error loading job counts:', error);
      }
    };

    loadJobCounts();

    // Set up a listener for localStorage changes to update counts in real-time
    const handleStorageChange = () => {
      loadJobCounts();
    };

    window.addEventListener('storage', handleStorageChange);
    // Also listen for custom events for same-tab updates
    window.addEventListener('jobsUpdated', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('jobsUpdated', handleStorageChange);
    };
  }, [user]);


  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Remember scroll position for mobile
  useEffect(() => {
    if (!isMobile) return;
    const saved = sessionStorage.getItem('tabNavScrollX');
    if (scrollRef.current && saved) {
      scrollRef.current.scrollLeft = parseInt(saved, 10);
    }
  }, [isMobile]);

  const handleTabChange = (value: string | null) => {
    if (!value) return;

    // If user is not authenticated, trigger auth modal instead of navigation
    if (!user) {
      onAuthRequired?.();
      return;
    }
    
    // Use onTabChange callback for client-side navigation
    if (onTabChange) {
      onTabChange(value as JobStatus);
    }
  };  if (isMobile) {
    return (
      <Box style={{ backgroundColor: backgroundColor || '#F8F9FA', paddingTop: '16px', paddingBottom: '16px' }}>
        <div
          ref={scrollRef}
          style={{
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            whiteSpace: 'nowrap',
            paddingLeft: '16px',
            paddingRight: '8px',
            margin: '0 0 0 0',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
          onScroll={e => {
            sessionStorage.setItem('tabNavScrollX', String((e.target as HTMLDivElement).scrollLeft));
          }}
        >
          <Tabs
            value={getCurrentTab()}
            onChange={handleTabChange}
            variant="unstyled"
            styles={{
              list: {
                borderBottom: 'none',
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'nowrap',
              },
              tab: {
                border: 'none',
                backgroundColor: 'transparent',
                display: 'inline-flex',
                alignItems: 'center',
                fontSize: '1.25rem',
                fontWeight: 600,
                marginRight: 0,
                whiteSpace: 'nowrap',
                '&:hover': {
                  backgroundColor: 'transparent',
                },
              },
            }}
          >
            <Tabs.List>
              {JOB_TABS.map((tab, index) => {
                const currentTab = getCurrentTab();
                const isActive = currentTab === tab.value;
                const isFirstTab = index === 0;
                const isLastTab = index === JOB_TABS.length - 1;
                const count = jobCounts[tab.value as JobStatus];
                return (
                  <span key={tab.value} style={{ display: 'inline-flex', alignItems: 'center' }}>
                    <Tabs.Tab
                      value={tab.value}
                      style={{
                        color: isActive ? '#000000' : '#BEBEC1',
                        fontWeight: 'bold',
                        fontSize: '1.25rem',
                        background: 'transparent',
                        borderRadius: 0,
                        paddingLeft: isFirstTab ? '0px' : '16px',
                        paddingRight: '16px',
                        paddingTop: '8px',
                        paddingBottom: '8px',
                        marginRight: 0,
                        whiteSpace: 'nowrap',
                        position: 'relative',
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {tab.label}
                        {count > 0 && (
                          <span style={{
                            backgroundColor: isActive ? '#000000' : '#BEBEC1',
                            color: '#FFFFFF',
                            fontSize: '0.625rem',
                            fontWeight: 'bold',
                            padding: '2px 6px',
                            borderRadius: '10px',
                            lineHeight: '1',
                            minWidth: '18px',
                            textAlign: 'center',
                            display: 'inline-block',
                          }}>
                            {count}
                          </span>
                        )}
                      </span>
                    </Tabs.Tab>
                    {!isLastTab && (
                      <span style={{
                        color: '#BEBEC1',
                        fontSize: '0.625rem',
                        fontWeight: 'bold',
                        padding: '0 8px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: 0.5,
                        userSelect: 'none',
                      }}>
                        |
                      </span>
                    )}
                  </span>
                );
              })}
            </Tabs.List>
          </Tabs>
        </div>
      </Box>
    );
  }
  // Desktop version
  return (
    <Box style={{ backgroundColor: backgroundColor || '#F8F9FA', paddingTop: '32px' }}>
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
              const currentTab = getCurrentTab();
              const isActive = currentTab === tab.value;
              const isFirstTab = index === 0; // Check if it's the first tab ("New")
              const isLastTab = index === JOB_TABS.length - 1;
              const count = jobCounts[tab.value as JobStatus];
              
              return (
                <React.Fragment key={tab.value}>
                  <Tabs.Tab 
                    value={tab.value}
                    style={{
                      color: isActive ? '#000000' : '#BEBEC1',
                      fontWeight: 'bold',
                      fontSize: '1.25rem',
                      paddingLeft: isFirstTab ? '0px' : undefined, // Remove left padding for first tab
                      position: 'relative',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {tab.label}
                      {count > 0 && (
                        <span style={{
                          backgroundColor: isActive ? '#000000' : '#BEBEC1',
                          color: '#FFFFFF',
                          fontSize: '0.75rem',
                          fontWeight: 'bold',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          lineHeight: '1',
                          minWidth: '20px',
                          textAlign: 'center',
                          display: 'inline-block',
                        }}>
                          {count}
                        </span>
                      )}
                    </span>
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