import { SearchFormData, Job } from '@/types/job';

const SEARCH_DATA_KEY = 'searchingTheFox_searchData';
const SEARCH_RESULTS_KEY = 'searchingTheFox_searchResults';
const PAGE_FILTER_KEY = 'searchingTheFox_pageFilter';
const FILTER_DISABLED_KEY = 'searchingTheFox_filterDisabled';
const JOB_OPERATION_KEY = 'searchingTheFox_jobOperation';

export const searchStorage = {
  // Save search criteria
  saveSearchData: (searchData: SearchFormData): void => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(SEARCH_DATA_KEY, JSON.stringify(searchData));
      }
    } catch (error) {
      console.warn('Failed to save search data to localStorage:', error);
    }
  },

  // Load search criteria
  loadSearchData: (): SearchFormData | null => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem(SEARCH_DATA_KEY);
        return saved ? JSON.parse(saved) : null;
      }
    } catch (error) {
      console.warn('Failed to load search data from localStorage:', error);
    }
    return null;
  },

  // Save search results and state
  saveSearchResults: (data: {
    jobs: Job[];
    searchStarted: boolean;
    searchData: SearchFormData;
  }): void => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(SEARCH_RESULTS_KEY, JSON.stringify(data));
      }
    } catch (error) {
      console.warn('Failed to save search results to localStorage:', error);
    }
  },

  // Load search results and state
  loadSearchResults: (): {
    jobs: Job[];
    searchStarted: boolean;
    searchData: SearchFormData;
  } | null => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem(SEARCH_RESULTS_KEY);
        return saved ? JSON.parse(saved) : null;
      }
    } catch (error) {
      console.warn('Failed to load search results from localStorage:', error);
    }
    return null;
  },

  // Clear all stored data (when new search is performed)
  clearSearchData: (): void => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(SEARCH_DATA_KEY);
        localStorage.removeItem(SEARCH_RESULTS_KEY);
      }
    } catch (error) {
      console.warn('Failed to clear search data from localStorage:', error);
    }
  },

  // Clear all stored data including page filter (for complete migration)
  clearAllData: (): void => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(SEARCH_DATA_KEY);
        localStorage.removeItem(SEARCH_RESULTS_KEY);
        localStorage.removeItem(PAGE_FILTER_KEY);
      }
    } catch (error) {
      console.warn('Failed to clear all data from localStorage:', error);
    }
  },

  // Clear only results but preserve search form data
  clearResultsOnly: (): void => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(SEARCH_RESULTS_KEY);
        // Keep SEARCH_DATA_KEY intact
      }
    } catch (error) {
      console.warn('Failed to clear results from localStorage:', error);
    }
  },

  // Save page filter preferences
  savePageFilter: (filterValue: string): void => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(PAGE_FILTER_KEY, filterValue);
      }
    } catch (error) {
      console.warn('Failed to save page filter to localStorage:', error);
    }
  },

  // Load page filter preferences
  loadPageFilter: (): string | null => {
    try {
      if (typeof window !== 'undefined') {
        return localStorage.getItem(PAGE_FILTER_KEY);
      }
    } catch (error) {
      console.warn('Failed to load page filter from localStorage:', error);
    }
    return null;
  },

  // Check if page filter preferences exist
  hasPageFilter: (): boolean => {
    try {
      if (typeof window !== 'undefined') {
        return localStorage.getItem(PAGE_FILTER_KEY) !== null;
      }
    } catch (error) {
      console.warn('Failed to check page filter in localStorage:', error);
    }
    return false;
  },

  // Save filter disabled state (when user manually clears filters)
  setFilterDisabled: (userId: string, disabled: boolean): void => {
    try {
      if (typeof window !== 'undefined') {
        const key = `${FILTER_DISABLED_KEY}_${userId}`;
        if (disabled) {
          localStorage.setItem(key, 'true');
        } else {
          localStorage.removeItem(key);
        }
      }
    } catch (error) {
      console.warn('Failed to save filter disabled state:', error);
    }
  },

  // Check if filter is disabled for user
  isFilterDisabled: (userId: string): boolean => {
    try {
      if (typeof window !== 'undefined') {
        const key = `${FILTER_DISABLED_KEY}_${userId}`;
        return localStorage.getItem(key) === 'true';
      }
    } catch (error) {
      console.warn('Failed to check filter disabled state:', error);
    }
    return false;
  },
};

// Job operation state for persistent progress tracking
export interface JobOperationState {
  operationId: string;
  userId: string;
  operationType: 'status-change' | 'remove';
  targetStatus?: string;
  targetStatusLabel?: string;
  jobs: Array<{
    userJobId: string;
    title: string;
    company: string;
    jobId: string;
  }>;
  processedJobIds: string[]; // userJobIds that have been processed
  startedAt: number;
  lastUpdatedAt: number;
  completed: boolean;
  successCount: number;
  failedCount: number;
}

export const jobOperationStorage = {
  // Save ongoing operation state
  saveOperation: (state: JobOperationState): void => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(JOB_OPERATION_KEY, JSON.stringify(state));
      }
    } catch (error) {
      console.warn('Failed to save job operation to localStorage:', error);
    }
  },

  // Load ongoing operation state
  loadOperation: (): JobOperationState | null => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem(JOB_OPERATION_KEY);
        if (saved) {
          const state = JSON.parse(saved) as JobOperationState;
          // Check if operation is still valid (not older than 1 hour)
          const oneHourAgo = Date.now() - 60 * 60 * 1000;
          if (state.lastUpdatedAt > oneHourAgo) {
            return state;
          } else {
            // Clean up stale operation
            localStorage.removeItem(JOB_OPERATION_KEY);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load job operation from localStorage:', error);
    }
    return null;
  },

  // Update operation progress
  updateProgress: (
    processedJobId: string,
    success: boolean
  ): void => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem(JOB_OPERATION_KEY);
        if (saved) {
          const state = JSON.parse(saved) as JobOperationState;
          state.processedJobIds.push(processedJobId);
          state.lastUpdatedAt = Date.now();
          if (success) {
            state.successCount++;
          } else {
            state.failedCount++;
          }
          localStorage.setItem(JOB_OPERATION_KEY, JSON.stringify(state));
        }
      }
    } catch (error) {
      console.warn('Failed to update job operation progress:', error);
    }
  },

  // Mark operation as complete
  completeOperation: (): void => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem(JOB_OPERATION_KEY);
        if (saved) {
          const state = JSON.parse(saved) as JobOperationState;
          state.completed = true;
          state.lastUpdatedAt = Date.now();
          localStorage.setItem(JOB_OPERATION_KEY, JSON.stringify(state));
          // Clear operation after a short delay
          setTimeout(() => {
            localStorage.removeItem(JOB_OPERATION_KEY);
          }, 5000);
        }
      }
    } catch (error) {
      console.warn('Failed to complete job operation:', error);
    }
  },

  // Clear operation state
  clearOperation: (): void => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(JOB_OPERATION_KEY);
      }
    } catch (error) {
      console.warn('Failed to clear job operation from localStorage:', error);
    }
  },

  // Check if there's an ongoing operation
  hasOngoingOperation: (): boolean => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem(JOB_OPERATION_KEY);
        if (saved) {
          const state = JSON.parse(saved) as JobOperationState;
          return !state.completed;
        }
      }
    } catch (error) {
      console.warn('Failed to check ongoing operation:', error);
    }
    return false;
  },
};
