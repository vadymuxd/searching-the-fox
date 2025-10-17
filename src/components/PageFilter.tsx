'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Group,
  TextInput,
  Button,
  rem,
  Stack,
  useMantineTheme,
  Text,
  ActionIcon,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconFilter, IconX, IconCornerDownLeft } from '@tabler/icons-react';
import { TextButton } from './TextButton';
import { Job } from '@/types/job';
import { searchStorage } from '@/lib/localStorage';
import { jobsDataManager } from '@/lib/jobsDataManager';
import { useAuth } from '@/lib/auth/AuthContext';

interface PageFilterProps {
  jobs: Job[];
  onFilteredJobsChange: (filteredJobs: Job[]) => void;
  onReady?: () => void; // signals when initial filter state is applied
}

export function PageFilter({ jobs, onFilteredJobsChange, onReady }: PageFilterProps) {
  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);
  const { user } = useAuth();
  const [filterValue, setFilterValue] = useState('');
  const [appliedKeywords, setAppliedKeywords] = useState<string[]>([]);
  const [filtersApplied, setFiltersApplied] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Track if we've already loaded data for this user to prevent re-loading
  const userDataLoadedRef = useRef<string | null>(null);
  const jobsLengthRef = useRef<number>(0);
  const initialLoadCompleteRef = useRef(false);
  const onReadyCalledRef = useRef(false);

  // Memoize the filter application logic
  const applyFilter = useCallback((filterText: string, jobList: Job[]) => {
    if (!filterText.trim()) {
      onFilteredJobsChange(jobList);
      setAppliedKeywords([]);
      setFiltersApplied(false);
      return;
    }

    const searchTerms = filterText
      .split(',')
      .map(term => term.trim().toLowerCase())
      .filter(term => term.length > 0);

    if (searchTerms.length === 0) {
      onFilteredJobsChange(jobList);
      setAppliedKeywords([]);
      setFiltersApplied(false);
      return;
    }

    const filteredJobs = jobList.filter(job => {
      const jobTitle = job.title.toLowerCase();
      return searchTerms.some(term => jobTitle.includes(term));
    });

    onFilteredJobsChange(filteredJobs);
    setAppliedKeywords(searchTerms);
    setFiltersApplied(true);
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
      setIsLoading(false);
      // Ensure onReady is fired once even when skipping subsequent loads
      if (!onReadyCalledRef.current) {
        onReadyCalledRef.current = true;
        onReady?.();
      }
      return;
    }
    
    console.log('PageFilter: Loading data for user:', currentUserId, 'jobsChanged:', jobsChanged);
    
    // Update refs
    userDataLoadedRef.current = currentUserId;
    jobsLengthRef.current = jobs.length;
    
    // Load filter - database for authenticated users ONLY, localStorage for anonymous users ONLY
    const loadFilter = async () => {
      setIsLoading(true);
      let savedFilter: string | null = null;
      
      // ALWAYS reset filter value first when user changes to prevent contamination
      setFilterValue('');
      setFiltersApplied(false);
      setAppliedKeywords([]);
      
      if (user) {
        // For authenticated users: ONLY use database, ignore localStorage completely
        console.log('Loading filter for authenticated user:', user.id);
        const { success, keywords } = await jobsDataManager.getUserKeywords(user.id);
        if (success && keywords.length > 0) {
          savedFilter = keywords.join(', ');
          console.log('Loaded keywords from cache layer:', keywords);
        } else {
          console.log('No keywords found for user');
        }
        // If no keywords in database, don't use any filter (don't fallback to localStorage)
      } else {
        // For anonymous users: ONLY use localStorage
        console.log('Loading filter for anonymous user from localStorage');
        savedFilter = searchStorage.loadPageFilter();
      }
      
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
      setIsLoading(false);
      if (!onReadyCalledRef.current) {
        onReadyCalledRef.current = true;
        onReady?.();
      }
    };
    
    // Only load if we have jobs to filter
    if (jobs.length > 0) {
      loadFilter();
    } else {
      // If no jobs, just show empty results
      onFilteredJobsChange(jobs);
      initialLoadCompleteRef.current = true;
      setIsLoading(false);
      if (!onReadyCalledRef.current) {
        onReadyCalledRef.current = true;
        onReady?.();
      }
    }
  }, [jobs, user, mounted, applyFilter, onFilteredJobsChange, onReady]);

  const handleFilter = useCallback(async () => {
    if (filterValue.trim()) {
      // Save keywords to database/localStorage
      if (user) {
        // For authenticated users: Save to database
        const keywords = filterValue
          .split(',')
          .map(term => term.trim())
          .filter(term => term.length > 0);
        console.log('Saving keywords to database for user:', user.id, keywords);
        const result = await jobsDataManager.saveUserKeywords(user.id, keywords);
        if (result.success) {
          console.log('Keywords saved successfully');
        } else {
          console.error('Failed to save keywords to database:', result.error);
        }
      } else {
        // For anonymous users: Save to localStorage
        console.log('Saving filter to localStorage for anonymous user');
        searchStorage.savePageFilter(filterValue);
      }
    }
    
    // Apply the filter
    applyFilter(filterValue, jobs);
  }, [filterValue, jobs, applyFilter, user]);

  const handleClear = useCallback(() => {
    setFilterValue('');
    setFiltersApplied(false);
    setAppliedKeywords([]);
    onFilteredJobsChange(jobs);
  }, [jobs, onFilteredJobsChange]);

  const handleKeyPress = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleFilter();
    }
  }, [handleFilter]);

  // Show loading state while filter data is being loaded
  if (isLoading) {
    return (
      <Text size="sm" c="dimmed">
        Loading filters...
      </Text>
    );
  }

  // Variant B: Filters Applied - Show applied keywords and clear button
  if (filtersApplied && appliedKeywords.length > 0) {
    return (
      <Stack gap="xs">
        <Text size="sm" c="dimmed">
          Filtered by keywords: {appliedKeywords.join(', ')}
        </Text>
        <div>
          <TextButton onClick={handleClear} size="sm" leftSection={<IconX size={16} />}>
            Clear filters
          </TextButton>
        </div>
      </Stack>
    );
  }

  // Variant A: Filters Not Applied - Show input field and filter button
  return (
    <>
      {isMobile ? (
        // Mobile layout: Single line with right-side Enter icon inside the input
        <TextInput
          placeholder={filterValue ? undefined : "Filter by job titles with comma"}
          leftSection={<IconFilter style={{ width: rem(16), height: rem(16) }} />}
          rightSection={
            <ActionIcon
              variant="filled"
              color="dark"
              size={28}
              radius="sm"
              aria-label="Apply filter"
              onClick={handleFilter}
              title="Apply filter (Enter)"
            >
              <IconCornerDownLeft size={16} />
            </ActionIcon>
          }
          value={filterValue}
          onChange={(event) => setFilterValue(event.currentTarget.value)}
          onKeyPress={handleKeyPress}
          size="sm"
          styles={{
            input: {
              '&::placeholder': {
                color: '#868e96',
                fontStyle: 'normal',
              },
            },
          }}
        />
      ) : (
        // Desktop layout: Single row
        <Group gap="md" align="end" wrap="nowrap">
          <TextInput
            placeholder={filterValue ? undefined : "Use comma-separated job titles as filters"}
            leftSection={<IconFilter style={{ width: rem(16), height: rem(16) }} />}
            value={filterValue}
            onChange={(event) => setFilterValue(event.currentTarget.value)}
            onKeyPress={handleKeyPress}
            style={{ flex: 1, minWidth: '200px' }}
            size="sm"
            styles={{
              input: {
                '&::placeholder': {
                  color: '#868e96',
                  fontStyle: 'normal',
                },
              },
            }}
          />
          
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
