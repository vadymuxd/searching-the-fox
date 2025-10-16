import { searchStorage } from '@/lib/localStorage';
import { saveJobsToDatabase } from './jobService';
import { saveLastSearch, saveUserKeywords } from './userPreferences';

// Import types for server actions
import type { Job, SearchFormData } from '@/types/job';

export interface MigrationResult {
  success: boolean;
  jobsSaved: number;
  preferencesUpdated: boolean;
  keywordsSaved: boolean;
  error?: string;
}

/**
 * Migrate all localStorage data to database for a newly authenticated user
 * This includes jobs, search preferences, and keywords
 */
export async function migrateLocalStorageToDatabase(userId: string): Promise<MigrationResult> {
  try {
    console.log('Starting localStorage migration for user:', userId);
    
    let jobsSaved = 0;
    let preferencesUpdated = false;
    let keywordsSaved = false;

    // 1. Migrate jobs and search results
    const localResults = searchStorage.loadSearchResults();
    if (localResults && localResults.jobs.length > 0) {
      console.log(`Migrating ${localResults.jobs.length} jobs to database`);
      const jobResult = await saveJobsToDatabase(localResults.jobs, userId);
      if (jobResult.success) {
        jobsSaved = jobResult.jobsSaved;
        console.log(`Successfully migrated ${jobsSaved} jobs`);

        // Also save the search preferences from the results
        if (localResults.searchData) {
          const prefResult = await saveLastSearch(userId, localResults.searchData);
          if (prefResult.success) {
            preferencesUpdated = true;
            console.log('Successfully migrated search preferences');
          } else {
            console.warn('Failed to migrate search preferences:', prefResult.error);
          }
        }
      } else {
        console.error('Failed to migrate jobs:', jobResult.error);
        return {
          success: false,
          jobsSaved: 0,
          preferencesUpdated: false,
          keywordsSaved: false,
          error: jobResult.error
        };
      }
    } else {
      // Even if no jobs, try to migrate search preferences
      const localSearchData = searchStorage.loadSearchData();
      if (localSearchData) {
        console.log('Migrating search preferences without jobs');
        const prefResult = await saveLastSearch(userId, localSearchData);
        if (prefResult.success) {
          preferencesUpdated = true;
          console.log('Successfully migrated search preferences');
        } else {
          console.warn('Failed to migrate search preferences:', prefResult.error);
        }
      }
    }

    // 2. Migrate page filter keywords
    const localPageFilter = searchStorage.loadPageFilter();
    if (localPageFilter && localPageFilter.trim()) {
      console.log('Migrating page filter keywords:', localPageFilter);
      const keywords = localPageFilter
        .split(',')
        .map(term => term.trim())
        .filter(term => term.length > 0);
      
      if (keywords.length > 0) {
        const keywordResult = await saveUserKeywords(userId, keywords);
        if (keywordResult.success) {
          keywordsSaved = true;
          console.log('Successfully migrated keywords:', keywords);
        } else {
          console.warn('Failed to migrate keywords:', keywordResult.error);
        }
      }
    }

    // 3. Clear localStorage after successful migration
    if (jobsSaved > 0 || preferencesUpdated || keywordsSaved) {
      console.log('Clearing localStorage after successful migration');
      searchStorage.clearAllData();
    }

    const result: MigrationResult = {
      success: true,
      jobsSaved,
      preferencesUpdated,
      keywordsSaved
    };

    console.log('Migration completed successfully:', result);
    return result;

  } catch (error) {
    console.error('Error during localStorage migration:', error);
    return {
      success: false,
      jobsSaved: 0,
      preferencesUpdated: false,
      keywordsSaved: false,
      error: error instanceof Error ? error.message : 'Unknown migration error'
    };
  }
}

/**
 * Check if there's any localStorage data that needs migration
 */
export function hasLocalDataForMigration(): boolean {
  try {
    if (typeof window === 'undefined') return false;

    const hasResults = searchStorage.loadSearchResults() !== null;
    const hasSearchData = searchStorage.loadSearchData() !== null;
    const hasPageFilter = searchStorage.hasPageFilter();

    return hasResults || hasSearchData || hasPageFilter;
  } catch (error) {
    console.warn('Error checking for localStorage data:', error);
    return false;
  }
}

/**
 * Get a summary of what localStorage data exists for migration
 */
export function getLocalDataSummary(): {
  jobsCount: number;
  hasPreferences: boolean;
  hasKeywords: boolean;
} {
  try {
    if (typeof window === 'undefined') {
      return { jobsCount: 0, hasPreferences: false, hasKeywords: false };
    }

    const results = searchStorage.loadSearchResults();
    const searchData = searchStorage.loadSearchData();
    const pageFilter = searchStorage.loadPageFilter();

    return {
      jobsCount: results?.jobs?.length || 0,
      hasPreferences: !!(results?.searchData || searchData),
      hasKeywords: !!(pageFilter && pageFilter.trim())
    };
  } catch (error) {
    console.warn('Error getting localStorage data summary:', error);
    return { jobsCount: 0, hasPreferences: false, hasKeywords: false };
  }
}