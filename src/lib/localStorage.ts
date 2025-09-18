import { SearchFormData, Job } from '@/types/job';

const SEARCH_DATA_KEY = 'searchingTheFox_searchData';
const SEARCH_RESULTS_KEY = 'searchingTheFox_searchResults';
const PAGE_FILTER_KEY = 'searchingTheFox_pageFilter';
const SELECTED_JOBS_KEY = 'searchingTheFox_selectedJobs';

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
        // Clear selected jobs when clearing search data
        localStorage.removeItem(SELECTED_JOBS_KEY);
      }
    } catch (error) {
      console.warn('Failed to clear search data from localStorage:', error);
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

  // Save selected job IDs
  saveSelectedJobs: (selectedJobIds: string[]): void => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(SELECTED_JOBS_KEY, JSON.stringify(selectedJobIds));
      }
    } catch (error) {
      console.warn('Failed to save selected jobs to localStorage:', error);
    }
  },

  // Load selected job IDs
  loadSelectedJobs: (): string[] => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem(SELECTED_JOBS_KEY);
        return saved ? JSON.parse(saved) : [];
      }
    } catch (error) {
      console.warn('Failed to load selected jobs from localStorage:', error);
    }
    return [];
  },

  // Clear selected jobs
  clearSelectedJobs: (): void => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(SELECTED_JOBS_KEY);
      }
    } catch (error) {
      console.warn('Failed to clear selected jobs from localStorage:', error);
    }
  },
};
