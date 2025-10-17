import { SearchFormData, Job } from '@/types/job';

const SEARCH_DATA_KEY = 'searchingTheFox_searchData';
const SEARCH_RESULTS_KEY = 'searchingTheFox_searchResults';
const PAGE_FILTER_KEY = 'searchingTheFox_pageFilter';
const FILTER_DISABLED_KEY = 'searchingTheFox_filterDisabled';

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
