'use client';

import { Job, SearchFormData } from '@/types/job';
import { getUserJobs, saveJobsToDatabase } from '@/lib/db/jobService';
import { searchStorage } from '@/lib/localStorage';
import type { UserPreferences } from '@/lib/db/userPreferences';
import {
  getUserKeywords as fetchUserKeywords,
  getUserPreferences as fetchUserPreferences,
  saveLastSearch as saveLastSearchToDb,
  saveUserKeywords as persistUserKeywords,
} from '@/lib/db/userPreferences';

// Storage keys for authenticated users
const CACHED_JOBS_KEY = 'searchingTheFox_cachedJobs';
const CACHED_JOBS_METADATA_KEY = 'searchingTheFox_cachedJobsMetadata';
const LAST_SYNC_KEY = 'searchingTheFox_lastSync';
const CACHE_TTL_HOURS = 1;
const KEYWORDS_CACHE_TTL_HOURS = 6;
const PREFERENCES_CACHE_TTL_HOURS = 1;

interface CachedJobsData {
  [status: string]: Job[];
  all: Job[];
}

interface CachedJobsMetadata {
  userId: string;
  lastUpdated: string;
  searchData?: SearchFormData;
  keywords?: string[];
  keywordsUpdatedAt?: string;
  preferences?: UserPreferences;
  preferencesUpdatedAt?: string;
}

class JobsDataManager {
  private static instance: JobsDataManager;
  private cachedJobs: CachedJobsData | null = null;
  private cachedMetadata: CachedJobsMetadata | null = null;
  private syncInProgress = false;

  static getInstance(): JobsDataManager {
    if (!JobsDataManager.instance) {
      JobsDataManager.instance = new JobsDataManager();
    }
    return JobsDataManager.instance;
  }

  /**
   * Load jobs for authenticated users with cache-first strategy
   */
  async getJobsForUser(userId: string, status?: string): Promise<{ success: boolean; jobs: Job[]; fromCache: boolean; error?: string }> {
    try {
      // First, try to get from cache if it's for the same user and not too old
      const cached = this.getCachedJobs(userId);
      if (cached.success && cached.data) {
        const jobsForStatus = status ? cached.data[status] || [] : cached.data.all || [];
        return {
          success: true,
          jobs: jobsForStatus,
          fromCache: true
        };
      }

      // If no cache or cache is invalid, fetch from database and update cache
      return await this.syncWithDatabase(userId, status);
    } catch (error) {
      console.error('Error in getJobsForUser:', error);
      return {
        success: false,
        jobs: [],
        fromCache: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Load user keywords with cache-first strategy
   */
  async getUserKeywords(
    userId: string,
    forceSync = false
  ): Promise<{ success: boolean; keywords: string[]; fromCache: boolean; error?: string }> {
    try {
      const metadata = this.getMetadataForUser(userId);

      if (!forceSync && metadata && this.isTimestampFresh(metadata.keywordsUpdatedAt, KEYWORDS_CACHE_TTL_HOURS)) {
        return {
          success: true,
          keywords: metadata.keywords || [],
          fromCache: true,
        };
      }

      const result = await fetchUserKeywords(userId);

      if (!result.success) {
        if (metadata?.keywords) {
          return {
            success: true,
            keywords: metadata.keywords,
            fromCache: true,
          };
        }

        return {
          success: false,
          keywords: [],
          fromCache: false,
          error: result.error,
        };
      }

      const keywords = result.keywords || [];
      this.updateCachedKeywords(userId, keywords);

      return {
        success: true,
        keywords,
        fromCache: false,
      };
    } catch (error) {
      console.error('Error getting user keywords:', error);
      return {
        success: false,
        keywords: [],
        fromCache: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Load user preferences with cache-first strategy
   */
  async getUserPreferences(
    userId: string,
    forceSync = false
  ): Promise<{ success: boolean; preferences: UserPreferences | null; fromCache: boolean; error?: string }> {
    try {
      const metadata = this.getMetadataForUser(userId);

      if (!forceSync && metadata && this.isTimestampFresh(metadata.preferencesUpdatedAt, PREFERENCES_CACHE_TTL_HOURS)) {
        return {
          success: true,
          preferences: metadata.preferences || null,
          fromCache: true,
        };
      }

      const result = await fetchUserPreferences(userId);

      if (!result.success) {
        if (metadata) {
          return {
            success: true,
            preferences: metadata.preferences || null,
            fromCache: true,
          };
        }

        return {
          success: false,
          preferences: null,
          fromCache: false,
          error: result.error,
        };
      }

      const preferences = result.preferences ?? null;
      this.updateCachedPreferences(userId, preferences);

      return {
        success: true,
        preferences,
        fromCache: false,
      };
    } catch (error) {
      console.error('Error getting user preferences:', error);
      return {
        success: false,
        preferences: null,
        fromCache: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Persist user keywords and update cache
   */
  async saveUserKeywords(
    userId: string,
    keywords: string[]
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await persistUserKeywords(userId, keywords);

      if (result.success) {
        this.updateCachedKeywords(userId, keywords);
      }

      return result;
    } catch (error) {
      console.error('Error saving user keywords:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Persist last search preferences and update cache
   */
  async saveLastSearch(
    userId: string,
    searchData: SearchFormData
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await saveLastSearchToDb(userId, searchData);

      if (result.success) {
        this.updateSearchDataInCache(userId, searchData);
      }

      return result;
    } catch (error) {
      console.error('Error saving last search:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Load jobs for guest users (uses existing localStorage system)
   */
  getJobsForGuest(): { success: boolean; jobs: Job[]; searchData: SearchFormData | null } {
    try {
      const savedResults = searchStorage.loadSearchResults();
      if (savedResults) {
        return {
          success: true,
          jobs: savedResults.jobs,
          searchData: savedResults.searchData
        };
      }

      // If no results, try to load just search data
      const savedSearchData = searchStorage.loadSearchData();
      return {
        success: true,
        jobs: [],
        searchData: savedSearchData
      };
    } catch (error) {
      console.error('Error loading guest jobs:', error);
      return {
        success: false,
        jobs: [],
        searchData: null
      };
    }
  }

  /**
   * Sync with database and update cache
   */
  async syncWithDatabase(userId: string, status?: string, forceSync = false): Promise<{ success: boolean; jobs: Job[]; fromCache: boolean; error?: string }> {
    if (this.syncInProgress && !forceSync) {
      // Return cached data if sync is in progress
      const cached = this.getCachedJobs(userId);
      if (cached.success && cached.data) {
        const jobsForStatus = status ? cached.data[status] || [] : cached.data.all || [];
        return {
          success: true,
          jobs: jobsForStatus,
          fromCache: true
        };
      }
    }

    this.syncInProgress = true;

    try {
      // Fetch all jobs from database to rebuild cache
      const result = await getUserJobs(userId);
      
      if (!result.success) {
        return {
          success: false,
          jobs: [],
          fromCache: false,
          error: result.error
        };
      }

      // Group jobs by status
      const groupedJobs: CachedJobsData = {
        all: result.jobs,
        new: result.jobs.filter(job => job.status === 'new'),
        interested: result.jobs.filter(job => job.status === 'interested'),
        applied: result.jobs.filter(job => job.status === 'applied'),
        progressed: result.jobs.filter(job => job.status === 'progressed'),
        rejected: result.jobs.filter(job => job.status === 'rejected'),
        archived: result.jobs.filter(job => job.status === 'archived'),
      };

      // Update cache
      this.setCachedJobs(userId, groupedJobs);

      // Return requested jobs
      const jobsForStatus = status ? groupedJobs[status] || [] : groupedJobs.all;
      
      return {
        success: true,
        jobs: jobsForStatus,
        fromCache: false
      };
    } catch (error) {
      console.error('Error syncing with database:', error);
      return {
        success: false,
        jobs: [],
        fromCache: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Save new jobs to database and update cache
   */
  async saveNewJobsAndSync(jobs: Job[], userId: string, searchData: SearchFormData): Promise<{ success: boolean; error?: string }> {
    try {
      // Save to database
      const result = await saveJobsToDatabase(jobs, userId);
      
      if (!result.success) {
        return {
          success: false,
          error: result.error
        };
      }

      // Force sync to get updated data with proper user_job_ids
      await this.syncWithDatabase(userId, undefined, true);

      // Update search data in metadata
      this.updateSearchDataInCache(userId, searchData);

      return {
        success: true
      };
    } catch (error) {
      console.error('Error saving new jobs and syncing:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Handle job status updates - update cache and database
   */
  async updateJobStatusAndSync(userJobId: string, newStatus: 'new' | 'interested' | 'applied' | 'progressed' | 'rejected' | 'archived', userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Update in cache first for immediate UI response
      this.updateJobStatusInCache(userJobId, newStatus);

      // Then sync with database to ensure consistency
      await this.syncWithDatabase(userId, undefined, true);

      return { success: true };
    } catch (error) {
      console.error('Error updating job status:', error);
      
      // Rollback cache on error by re-syncing
      await this.syncWithDatabase(userId, undefined, true);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Clear cache for user (e.g., on sign out)
   */
  clearCache(userId?: string): void {
    try {
      if (typeof window === 'undefined') return;

      if (userId && this.cachedMetadata?.userId !== userId) {
        return; // Don't clear if it's not for the current user
      }

      localStorage.removeItem(CACHED_JOBS_KEY);
      localStorage.removeItem(CACHED_JOBS_METADATA_KEY);
      localStorage.removeItem(LAST_SYNC_KEY);
      
      this.cachedJobs = null;
      this.cachedMetadata = null;
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  /**
   * Get cached search data for authenticated users
   */
  getCachedSearchData(userId: string): SearchFormData | null {
    try {
      const cached = this.getCachedJobsMetadata();
      if (cached.success && cached.metadata?.userId === userId) {
        if (cached.metadata.searchData) {
          return cached.metadata.searchData;
        }

        if (cached.metadata.preferences?.lastSearch) {
          return cached.metadata.preferences.lastSearch;
        }
      }
    } catch (error) {
      console.error('Error getting cached search data:', error);
    }
    return null;
  }

  /**
   * Update cached keywords manually (e.g., after saving)
   */
  updateCachedKeywords(userId: string, keywords: string[]): void {
    try {
      this.updateMetadata(userId, metadata => ({
        ...metadata,
        keywords,
        keywordsUpdatedAt: new Date().toISOString(),
      }));
    } catch (error) {
      console.error('Error updating cached keywords:', error);
    }
  }

  /**
   * Update cached preferences manually (e.g., after saving)
   */
  updateCachedPreferences(userId: string, preferences: UserPreferences | null): void {
    try {
      this.updateMetadata(userId, metadata => ({
        ...metadata,
        preferences: preferences || undefined,
        preferencesUpdatedAt: new Date().toISOString(),
        searchData: preferences?.lastSearch || metadata.searchData,
      }));
    } catch (error) {
      console.error('Error updating cached preferences:', error);
    }
  }

  // Private methods for cache management

  private getCachedJobs(userId: string): { success: boolean; data: CachedJobsData | null } {
    try {
      if (typeof window === 'undefined') {
        return { success: false, data: null };
      }

      // Check if we already have it in memory
      if (this.cachedJobs && this.cachedMetadata?.userId === userId) {
        return { success: true, data: this.cachedJobs };
      }

      // Load from localStorage
      const cached = localStorage.getItem(CACHED_JOBS_KEY);
      const metadata = this.getCachedJobsMetadata();

      if (!cached || !metadata.success || metadata.metadata?.userId !== userId) {
        return { success: false, data: null };
      }

      // Check if cache is not too old (max 1 hour for now)
      const lastUpdated = new Date(metadata.metadata.lastUpdated);
      const now = new Date();
      const hoursSinceUpdate = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60);

      if (hoursSinceUpdate > CACHE_TTL_HOURS) {
        // Cache is too old
        return { success: false, data: null };
      }

      const parsedData = JSON.parse(cached) as CachedJobsData;
      this.cachedJobs = parsedData;
      
      return { success: true, data: parsedData };
    } catch (error) {
      console.error('Error getting cached jobs:', error);
      return { success: false, data: null };
    }
  }

  private setCachedJobs(userId: string, jobs: CachedJobsData): void {
    try {
      if (typeof window === 'undefined') return;

      const existingMetadata = this.getMetadataForUser(userId);

      const metadata: CachedJobsMetadata = {
        userId,
        lastUpdated: new Date().toISOString(),
        searchData: existingMetadata?.searchData,
        keywords: existingMetadata?.keywords,
        keywordsUpdatedAt: existingMetadata?.keywordsUpdatedAt,
        preferences: existingMetadata?.preferences,
        preferencesUpdatedAt: existingMetadata?.preferencesUpdatedAt,
      };

      localStorage.setItem(CACHED_JOBS_KEY, JSON.stringify(jobs));
      this.cachedJobs = jobs;
      this.saveMetadata(metadata);
    } catch (error) {
      console.error('Error setting cached jobs:', error);
    }
  }

  private getCachedJobsMetadata(): { success: boolean; metadata: CachedJobsMetadata | null } {
    try {
      if (typeof window === 'undefined') {
        return { success: false, metadata: null };
      }

      // Check if we already have it in memory
      if (this.cachedMetadata) {
        return { success: true, metadata: this.cachedMetadata };
      }

      const cached = localStorage.getItem(CACHED_JOBS_METADATA_KEY);
      if (!cached) {
        return { success: false, metadata: null };
      }

      const metadata = JSON.parse(cached) as CachedJobsMetadata;
      this.cachedMetadata = metadata;
      
      return { success: true, metadata };
    } catch (error) {
      console.error('Error getting cached jobs metadata:', error);
      return { success: false, metadata: null };
    }
  }

  private updateJobStatusInCache(userJobId: string, newStatus: 'new' | 'interested' | 'applied' | 'progressed' | 'rejected' | 'archived'): void {
    if (!this.cachedJobs) return;

    try {
      // Find and update the job in all relevant arrays
      const allJobs = this.cachedJobs.all;
      const jobIndex = allJobs.findIndex(job => job.user_job_id === userJobId);
      
      if (jobIndex !== -1) {
        // Update the job status
        allJobs[jobIndex] = { ...allJobs[jobIndex], status: newStatus };

        // Rebuild status-specific arrays
        this.cachedJobs = {
          all: allJobs,
          new: allJobs.filter(job => job.status === 'new'),
          interested: allJobs.filter(job => job.status === 'interested'),
          applied: allJobs.filter(job => job.status === 'applied'),
          progressed: allJobs.filter(job => job.status === 'progressed'),
          rejected: allJobs.filter(job => job.status === 'rejected'),
          archived: allJobs.filter(job => job.status === 'archived'),
        };

        // Update localStorage
        if (this.cachedMetadata) {
          this.setCachedJobs(this.cachedMetadata.userId, this.cachedJobs);
        }
      }
    } catch (error) {
      console.error('Error updating job status in cache:', error);
    }
  }

  private updateSearchDataInCache(userId: string, searchData: SearchFormData): void {
    try {
      this.updateMetadata(userId, metadata => {
        const updatedPreferences = metadata.preferences
          ? { ...metadata.preferences, lastSearch: searchData }
          : { lastSearch: searchData };

        return {
          ...metadata,
          searchData,
          preferences: updatedPreferences,
          preferencesUpdatedAt: new Date().toISOString(),
        };
      });
    } catch (error) {
      console.error('Error updating search data in cache:', error);
    }
  }

  private isTimestampFresh(timestamp?: string, ttlHours = CACHE_TTL_HOURS): boolean {
    if (!timestamp) return false;

    const parsed = new Date(timestamp);
    if (Number.isNaN(parsed.getTime())) {
      return false;
    }

    const hoursSinceUpdate = (Date.now() - parsed.getTime()) / (1000 * 60 * 60);
    return hoursSinceUpdate < ttlHours;
  }

  private getMetadataForUser(userId: string): CachedJobsMetadata | null {
    const cached = this.getCachedJobsMetadata();
    if (cached.success && cached.metadata?.userId === userId) {
      return cached.metadata;
    }
    return null;
  }

  private saveMetadata(metadata: CachedJobsMetadata): void {
    if (typeof window === 'undefined') return;

    localStorage.setItem(CACHED_JOBS_METADATA_KEY, JSON.stringify(metadata));
    this.cachedMetadata = metadata;
  }

  private updateMetadata(userId: string, updater: (metadata: CachedJobsMetadata) => CachedJobsMetadata): void {
    if (typeof window === 'undefined') return;

    const existingMetadata = this.getMetadataForUser(userId);
    const baseMetadata: CachedJobsMetadata = existingMetadata || {
      userId,
      lastUpdated: new Date().toISOString(),
    };

    const updatedMetadata = updater(baseMetadata);
    const normalizedMetadata: CachedJobsMetadata = {
      ...updatedMetadata,
      userId,
      lastUpdated: updatedMetadata.lastUpdated || baseMetadata.lastUpdated || new Date().toISOString(),
    };

    this.saveMetadata(normalizedMetadata);
  }
}

export const jobsDataManager = JobsDataManager.getInstance();