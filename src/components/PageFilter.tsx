'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Group,
  TextInput,
  Button,
  rem,
  Stack,
  useMantineTheme,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconFilter, IconDeviceFloppy, IconClipboard } from '@tabler/icons-react';
import { SecondaryButton } from './SecondaryButton';
import { IconButton } from './IconButton';
import { Job } from '@/types/job';
import { searchStorage } from '@/lib/localStorage';
import { savePageFilter as savePageFilterToDb, getUserPreferences, getUserKeywords, saveUserKeywords } from '@/lib/db/userPreferences';
import { useAuth } from '@/lib/auth/AuthContext';

interface PageFilterProps {
  jobs: Job[];
  onFilteredJobsChange: (filteredJobs: Job[]) => void;
}

export function PageFilter({ jobs, onFilteredJobsChange }: PageFilterProps) {
  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);
  const { user } = useAuth();
  const [filterValue, setFilterValue] = useState('');
  const [hasSavedFilter, setHasSavedFilter] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  // Track if we've already loaded data for this user to prevent re-loading
  const userDataLoadedRef = useRef<string | null>(null);
  const jobsLengthRef = useRef<number>(0);
  const initialLoadCompleteRef = useRef(false);

  // Memoize the filter application logic
  const applyFilter = useCallback((filterText: string, jobList: Job[]) => {
    if (!filterText.trim()) {
      onFilteredJobsChange(jobList);
      return;
    }

    const searchTerms = filterText
      .split(',')
      .map(term => term.trim().toLowerCase())
      .filter(term => term.length > 0);

    if (searchTerms.length === 0) {
      onFilteredJobsChange(jobList);
      return;
    }

    const filteredJobs = jobList.filter(job => {
      const jobTitle = job.title.toLowerCase();
      return searchTerms.some(term => jobTitle.includes(term));
    });

    onFilteredJobsChange(filteredJobs);
  }, [onFilteredJobsChange]);

  // Check if there are saved filters on component mount
  useEffect(() => {
    console.log('PageFilter effect triggered - mounted:', mounted, 'user:', user?.id || 'anonymous', 'jobs.length:', jobs.length);
    
    if (!mounted) {
      setMounted(true);
    }
    
    // Skip if we've already completed initial load and user hasn't changed
    const currentUserId = user?.id || 'anonymous';
    const jobsChanged = jobs.length !== jobsLengthRef.current;
    
    if (initialLoadCompleteRef.current && 
        userDataLoadedRef.current === currentUserId && 
        !jobsChanged) {
      console.log('PageFilter: Skipping reload - data already loaded for user:', currentUserId);
      return;
    }
    
    console.log('PageFilter: Loading data for user:', currentUserId, 'jobsChanged:', jobsChanged);
    
    // Update refs
    userDataLoadedRef.current = currentUserId;
    jobsLengthRef.current = jobs.length;
    
    // Load filter - database for authenticated users ONLY, localStorage for anonymous users ONLY
    const loadFilter = async () => {
      let savedFilter: string | null = null;
      
      // ALWAYS reset filter value first when user changes to prevent contamination
      setFilterValue('');
      
      if (user) {
        // For authenticated users: ONLY use database, ignore localStorage completely
        console.log('Loading filter for authenticated user:', user.id);
        const { success, keywords } = await getUserKeywords(user.id);
        if (success && keywords && keywords.length > 0) {
          savedFilter = keywords.join(', ');
          console.log('Loaded keywords from database:', keywords);
        } else {
          console.log('No keywords found in database for user');
        }
        // If no keywords in database, don't use any filter (don't fallback to localStorage)
      } else {
        // For anonymous users: ONLY use localStorage
        console.log('Loading filter for anonymous user from localStorage');
        savedFilter = searchStorage.loadPageFilter();
      }
      
      setHasSavedFilter(!!savedFilter);
      
      // Auto-apply saved filter on mount ONLY if there is a saved filter
      if (savedFilter && savedFilter.trim()) {
        setFilterValue(savedFilter);
        // Apply filter to jobs list
        applyFilter(savedFilter, jobs);
      } else {
        // No saved filter: show all jobs without filtering
        onFilteredJobsChange(jobs);
      }
      
      initialLoadCompleteRef.current = true;
    };
    
    // Only load if we have jobs to filter
    if (jobs.length > 0) {
      loadFilter();
    } else if (!hasSavedFilter) {
      // If no jobs and no saved filter, just show empty results
      onFilteredJobsChange(jobs);
      initialLoadCompleteRef.current = true;
    }
  }, [jobs, user, mounted, applyFilter, onFilteredJobsChange]);

  const handleFilter = useCallback(() => {
    applyFilter(filterValue, jobs);
  }, [filterValue, jobs, applyFilter]);

  const handleClear = useCallback(() => {
    setFilterValue('');
    onFilteredJobsChange(jobs);
  }, [jobs, onFilteredJobsChange]);

  const handleSave = useCallback(async () => {
    if (filterValue.trim()) {
      if (user) {
        // For authenticated users: Save ONLY to database
        const keywords = filterValue
          .split(',')
          .map(term => term.trim())
          .filter(term => term.length > 0);
        console.log('Saving keywords to database for user:', user.id, keywords);
        const result = await saveUserKeywords(user.id, keywords);
        if (result.success) {
          console.log('Keywords saved successfully to database');
        } else {
          console.error('Failed to save keywords to database:', result.error);
        }
      } else {
        // For anonymous users: Save ONLY to localStorage
        console.log('Saving filter to localStorage for anonymous user');
        searchStorage.savePageFilter(filterValue);
      }
      setHasSavedFilter(true);
    }
  }, [filterValue, user]);

  const handlePaste = useCallback(async () => {
    let savedFilter: string | null = null;
    
    if (user) {
      // For authenticated users: Load ONLY from database
      console.log('Pasting filter from database for user:', user.id);
      const { success, keywords } = await getUserKeywords(user.id);
      if (success && keywords && keywords.length > 0) {
        savedFilter = keywords.join(', ');
        console.log('Pasted keywords from database:', keywords);
      } else {
        console.log('No keywords found in database to paste');
      }
    } else {
      // For anonymous users: Load ONLY from localStorage
      console.log('Pasting filter from localStorage for anonymous user');
      savedFilter = searchStorage.loadPageFilter();
    }
    
    if (savedFilter) {
      setFilterValue(savedFilter);
    }
  }, [user]);

  const handleKeyPress = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleFilter();
    }
  }, [handleFilter]);

  return (
    <>
      {isMobile ? (
        // Mobile layout: Input on first line, buttons on second line
        <Stack gap="md">
          <TextInput
            placeholder="Filter by job titles (comma separated)"
            leftSection={<IconFilter style={{ width: rem(16), height: rem(16) }} />}
            value={filterValue}
            onChange={(event) => setFilterValue(event.currentTarget.value)}
            onKeyPress={handleKeyPress}
            size="sm"
          />
          
          <Group gap="md" grow>
            {/* Save button - always visible */}
            <IconButton onClick={handleSave} title="Save filter preferences">
              <IconDeviceFloppy style={{ width: rem(16), height: rem(16) }} />
            </IconButton>
            
            {/* Paste button - only visible when there are saved filters */}
            {mounted && hasSavedFilter && (
              <IconButton onClick={handlePaste} title="Paste saved filter preferences">
                <IconClipboard style={{ width: rem(16), height: rem(16) }} />
              </IconButton>
            )}
            
            <SecondaryButton onClick={handleClear}>
              Clear
            </SecondaryButton>
            <Button
              onClick={handleFilter}
              size="sm"
              styles={{
                root: {
                  backgroundColor: '#000',
                  border: '1px solid #000',
                  height: rem(36),
                  '&:hover': {
                    backgroundColor: '#333',
                    borderColor: '#333',
                  },
                },
                label: {
                  fontSize: rem(14),
                },
              }}
            >
              Filter
            </Button>
          </Group>
        </Stack>
      ) : (
        // Desktop layout: Single row
        <Group gap="md" align="end" wrap="nowrap">
          <TextInput
            placeholder="Filter by job titles (comma separated)"
            leftSection={<IconFilter style={{ width: rem(16), height: rem(16) }} />}
            value={filterValue}
            onChange={(event) => setFilterValue(event.currentTarget.value)}
            onKeyPress={handleKeyPress}
            style={{ flex: 1, minWidth: '200px' }}
            size="sm"
          />
          
          {/* Save button - always visible */}
          <IconButton onClick={handleSave} title="Save filter preferences">
            <IconDeviceFloppy style={{ width: rem(16), height: rem(16) }} />
          </IconButton>
          
          {/* Paste button - only visible when there are saved filters */}
          {mounted && hasSavedFilter && (
            <IconButton onClick={handlePaste} title="Paste saved filter preferences">
              <IconClipboard style={{ width: rem(16), height: rem(16) }} />
            </IconButton>
          )}
          
          <SecondaryButton onClick={handleClear}>
            Clear
          </SecondaryButton>
          <Button
            onClick={handleFilter}
            size="sm"
            styles={{
              root: {
                backgroundColor: '#000',
                border: '1px solid #000',
                height: rem(36),
                minWidth: '80px',
                paddingLeft: rem(12),
                paddingRight: rem(12),
                '&:hover': {
                  backgroundColor: '#333',
                  borderColor: '#333',
                },
              },
              label: {
                fontSize: rem(14),
              },
            }}
          >
            Filter
          </Button>
        </Group>
      )}
    </>
  );
}
