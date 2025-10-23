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
import { IconFilter, IconX, IconCornerDownLeft, IconDeviceFloppy } from '@tabler/icons-react';
import { TextButton } from './TextButton';
import { SecondaryButton } from './SecondaryButton';
import { Job } from '@/types/job';
import { searchStorage } from '@/lib/localStorage';
import { jobsDataManager } from '@/lib/jobsDataManager';
import { useAuth } from '@/lib/auth/AuthContext';

interface PageFilterProps {
  jobs: Job[];
  onFilteredJobsChange: (filteredJobs: Job[]) => void;
  onReady?: () => void; // signals when initial filter state is applied
  onFilterStateChange?: (isFiltered: boolean) => void; // notify parent about filter state
}

export function PageFilter({ jobs, onFilteredJobsChange, onReady, onFilterStateChange }: PageFilterProps) {
  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);
  const { user } = useAuth();
  const [filterValue, setFilterValue] = useState('');
  const [appliedKeywords, setAppliedKeywords] = useState<string[]>([]);
  const [filtersApplied, setFiltersApplied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasSavedKeywords, setHasSavedKeywords] = useState(false);
  
  // Track if we've already loaded data for this user to prevent re-loading
  const userDataLoadedRef = useRef<string | null>(null);
  const jobsLengthRef = useRef<number>(0);
  const initialLoadCompleteRef = useRef(false);
  const onReadyCalledRef = useRef(false);
  const loadingRef = useRef(false); // Prevent concurrent loads
  const mountedRef = useRef(false); // Track component mount state

  // Memoize the filter application logic
  const applyFilter = useCallback((filterText: string, jobList: Job[]) => {
    if (!filterText.trim()) {
      onFilteredJobsChange(jobList);
      setAppliedKeywords([]);
      setFiltersApplied(false);
      onFilterStateChange?.(false); // Notify parent: not filtered
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
      onFilterStateChange?.(false); // Notify parent: not filtered
      return;
    }

    const filteredJobs = jobList.filter(job => {
      const jobTitle = job.title.toLowerCase();
      return searchTerms.some(term => jobTitle.includes(term));
    });

    onFilteredJobsChange(filteredJobs);
    setAppliedKeywords(searchTerms);
    setFiltersApplied(true);
    onFilterStateChange?.(true); // Notify parent: filtered
  }, [onFilteredJobsChange, onFilterStateChange]);

  // Check if there are saved filters on component mount
  useEffect(() => {
  console.log('PageFilter effect triggered - user:', user?.id || 'anonymous', 'jobs.length:', jobs.length, 'loading:', loadingRef.current);
  mountedRef.current = true;
    
    let isMounted = true; // Track if component is still mounted
    
    // Prevent concurrent loads
    if (loadingRef.current) {
      console.log('PageFilter: Already loading, skipping');
      return;
    }
    
    // Skip if we've already completed initial load and user hasn't changed
    const currentUserId = user?.id || 'anonymous';
    const jobsChanged = jobs.length !== jobsLengthRef.current;
    
    if (initialLoadCompleteRef.current && 
        userDataLoadedRef.current === currentUserId && 
        !jobsChanged) {
      console.log('PageFilter: Skipping reload - data already loaded for user:', currentUserId);
      if (isMounted) {
        setIsLoading(false);
      }
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
      loadingRef.current = true;
      if (isMounted) setIsLoading(true);
      let savedFilter: string | null = null;
      let skipApplyingFilter = false; // if true, don't apply even if savedFilter exists (e.g., disabled)

      // ALWAYS reset filter UI first to avoid stale flashes
      if (isMounted) {
        setFilterValue('');
        setFiltersApplied(false);
        setAppliedKeywords([]);
      }

      try {
        if (user) {
          // Quick cached path for immediate UI
          const filterDisabled = jobsDataManager.isFilterDisabled(user.id);
          skipApplyingFilter = filterDisabled;
          const cached = jobsDataManager.getCachedKeywords(user.id);
          if (isMounted) setHasSavedKeywords(Array.isArray(cached) && cached.length > 0);
          if (cached && cached.length > 0) {
            savedFilter = cached.join(', ');
          }
        } else {
          // Guest path
          const filterDisabled = searchStorage.isFilterDisabled('anonymous');
          skipApplyingFilter = filterDisabled;
          const savedKeywords = searchStorage.loadPageFilter();
          if (isMounted) setHasSavedKeywords(!!(savedKeywords && savedKeywords.trim()));
          savedFilter = savedKeywords;
        }

        // Apply immediately based on cached/local values
        if (!skipApplyingFilter && savedFilter && savedFilter.trim()) {
          if (isMounted) {
            setFilterValue(savedFilter);
            applyFilter(savedFilter, jobs);
          }
        } else {
          onFilteredJobsChange(jobs);
          onFilterStateChange?.(false);
        }

        // Mark initial load done and render UI now
        initialLoadCompleteRef.current = true;
        if (isMounted) setIsLoading(false);
      } catch (e) {
        console.error('PageFilter fast path error', e);
        onFilteredJobsChange(jobs);
        onFilterStateChange?.(false);
        initialLoadCompleteRef.current = true;
        if (isMounted) setIsLoading(false);
      } finally {
        loadingRef.current = false;
        if (!onReadyCalledRef.current) {
          onReadyCalledRef.current = true;
          onReady?.();
        }
      }

      // Background refresh for authenticated users to update hasSavedKeywords without blocking UI
      if (user) {
        (async () => {
          try {
            const { success, keywords } = await jobsDataManager.getUserKeywords(user.id);
            if (!mountedRef.current) return;
            if (success) {
              setHasSavedKeywords(Array.isArray(keywords) && keywords.length > 0);
              // Optionally update cached state internally; do NOT auto-apply here to avoid jarring changes
            }
          } catch (e) {
            console.warn('Background keywords refresh failed', e);
          }
        })();
      }
    };
    
    // Kick off loading regardless of jobs; when there are no jobs we simply don't apply filters
    loadFilter();
    
    // Cleanup function
    return () => {
      isMounted = false;
      mountedRef.current = false;
    };
  }, [jobs, user, applyFilter, onFilteredJobsChange, onFilterStateChange, onReady]);

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
          setHasSavedKeywords(true);
        } else {
          console.error('Failed to save keywords to database:', result.error);
        }
        // Re-enable filters when user applies them
        jobsDataManager.setFilterDisabled(user.id, false);
      } else {
        // For anonymous users: Save to localStorage
        console.log('Saving filter to localStorage for anonymous user');
        searchStorage.savePageFilter(filterValue);
        setHasSavedKeywords(true);
        // Re-enable filters when user applies them
        searchStorage.setFilterDisabled('anonymous', false);
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
    onFilterStateChange?.(false); // Notify parent: not filtered
    
    // Save filter disabled state when user manually clears
    if (user) {
      jobsDataManager.setFilterDisabled(user.id, true);
      console.log('Filter disabled for user:', user.id);
    } else {
      searchStorage.setFilterDisabled('anonymous', true);
      console.log('Filter disabled for anonymous user');
    }
  }, [jobs, onFilteredJobsChange, onFilterStateChange, user]);

  const handleUseRecentKeywords = useCallback(async () => {
    let savedFilter: string | null = null;
    
    // Load saved keywords
    if (user) {
      const { success, keywords } = await jobsDataManager.getUserKeywords(user.id);
      if (success && keywords.length > 0) {
        savedFilter = keywords.join(', ');
      }
    } else {
      savedFilter = searchStorage.loadPageFilter();
    }
    
    if (savedFilter && savedFilter.trim()) {
      // Re-enable filters
      if (user) {
        jobsDataManager.setFilterDisabled(user.id, false);
      } else {
        searchStorage.setFilterDisabled('anonymous', false);
      }
      
      // Set and apply the filter
      setFilterValue(savedFilter);
      applyFilter(savedFilter, jobs);
      console.log('Restored recent keywords:', savedFilter);
    }
  }, [user, jobs, applyFilter, onFilteredJobsChange, onFilterStateChange]);

  // When jobs change (e.g., after refresh load), if filters are applied, re-apply to new jobs
  // If no filters are applied, pass through all jobs to ensure filteredJobs is set
  useEffect(() => {
    if (filtersApplied && filterValue.trim() && jobs.length > 0) {
      applyFilter(filterValue, jobs);
    } else if (!filtersApplied && jobs.length > 0) {
      // No filters applied, pass through all jobs
      onFilteredJobsChange(jobs);
      onFilterStateChange?.(false);
    }
  }, [jobs, filtersApplied, filterValue, applyFilter, onFilteredJobsChange, onFilterStateChange]);

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
          {appliedKeywords.join(', ')}
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
        <Stack gap="xs">
          <TextInput
            placeholder={filterValue ? undefined : "Separate job titles by comma"}
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
          {hasSavedKeywords && (
            <div>
              <TextButton 
                onClick={handleUseRecentKeywords} 
                size="sm" 
                leftSection={<IconDeviceFloppy size={16} />}
              >
                Use recent keywords
              </TextButton>
            </div>
          )}
        </Stack>
      ) : (
        // Desktop layout: Single row
        <Group gap="md" align="end" wrap="nowrap">
          <TextInput
            placeholder={filterValue ? undefined : "Separate job titles by comma"}
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
          
          {hasSavedKeywords && (
            <SecondaryButton
              onClick={handleUseRecentKeywords}
              size="sm"
              leftSection={<IconDeviceFloppy size={16} />}
            >
              Use recent keywords
            </SecondaryButton>
          )}
          
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
