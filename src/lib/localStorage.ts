import { SearchFormData } from '@/types/job';

const SEARCH_DATA_KEY = 'searchingTheFox_searchData';
const SEARCH_RESULTS_KEY = 'searchingTheFox_searchResults';

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
    jobs: any[];
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
    jobs: any[];
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
};
