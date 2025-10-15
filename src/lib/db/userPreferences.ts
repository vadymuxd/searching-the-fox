'use server';

import { createClient } from '@/lib/supabase/server';
import { SearchFormData } from '@/types/job';

export interface UserPreferences {
  lastSearch?: SearchFormData;
  defaultLocation?: string;
  defaultSite?: string;
  defaultHoursOld?: string;
  defaultResultsWanted?: number;
  sortPreference?: string;
  displayMode?: string;
  pageFilter?: string; // Filter by job titles (comma separated)
  keywords?: string[]; // Saved filter keywords
}
/**
 * Get user keywords from database
 */
export async function getUserKeywords(
  userId: string
): Promise<{ success: boolean; keywords: string[] | null; error?: string }> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('users')
      .select('keywords')
      .eq('id', userId)
      .single();
    if (error) {
      return { success: false, keywords: null, error: error.message };
    }
    return { success: true, keywords: data?.keywords || null };
  } catch (error) {
    return {
      success: false,
      keywords: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Save user keywords to database
 */
export async function saveUserKeywords(
  userId: string,
  keywords: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('users')
      .update({ keywords, updated_at: new Date().toISOString() })
      .eq('id', userId);
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get user preferences from database
 */
export async function getUserPreferences(
  userId: string
): Promise<{ success: boolean; preferences: UserPreferences | null; error?: string }> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('users')
      .select('preferences')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching user preferences:', error);
      return { success: false, preferences: null, error: error.message };
    }

    return {
      success: true,
      preferences: (data?.preferences as UserPreferences) || {},
    };
  } catch (error) {
    console.error('Error in getUserPreferences:', error);
    return {
      success: false,
      preferences: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Save user's last search parameters to preferences
 */
export async function saveLastSearch(
  userId: string,
  searchData: SearchFormData
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    // Get current preferences
    const { data: currentData } = await supabase
      .from('users')
      .select('preferences')
      .eq('id', userId)
      .single();

    const currentPreferences = (currentData?.preferences as UserPreferences) || {};

    // Update with last search
    const updatedPreferences: UserPreferences = {
      ...currentPreferences,
      lastSearch: searchData,
      defaultLocation: searchData.location,
      defaultSite: searchData.site,
      defaultHoursOld: searchData.hoursOld,
      defaultResultsWanted: searchData.resultsWanted,
    };

    const { error } = await supabase
      .from('users')
      .update({
        preferences: updatedPreferences,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) {
      console.error('Error saving last search:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in saveLastSearch:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Update user preferences (partial update)
 */
export async function updateUserPreferences(
  userId: string,
  preferences: Partial<UserPreferences>
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    // Get current preferences
    const { data: currentData } = await supabase
      .from('users')
      .select('preferences')
      .eq('id', userId)
      .single();

    const currentPreferences = (currentData?.preferences as UserPreferences) || {};

    // Merge with new preferences
    const updatedPreferences: UserPreferences = {
      ...currentPreferences,
      ...preferences,
    };

    const { error } = await supabase
      .from('users')
      .update({
        preferences: updatedPreferences,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) {
      console.error('Error updating user preferences:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in updateUserPreferences:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get user's last search parameters
 */
export async function getLastSearch(
  userId: string
): Promise<{ success: boolean; searchData: SearchFormData | null; error?: string }> {
  try {
    const { success, preferences, error } = await getUserPreferences(userId);

    if (!success || !preferences) {
      return { success: false, searchData: null, error };
    }

    return {
      success: true,
      searchData: preferences.lastSearch || null,
    };
  } catch (error) {
    console.error('Error in getLastSearch:', error);
    return {
      success: false,
      searchData: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Save page filter preferences
 */
export async function savePageFilter(
  userId: string,
  filterValue: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    // Get current preferences
    const { data: currentData } = await supabase
      .from('users')
      .select('preferences')
      .eq('id', userId)
      .single();

    const currentPreferences = (currentData?.preferences as UserPreferences) || {};

    // Update with page filter
    const updatedPreferences: UserPreferences = {
      ...currentPreferences,
      pageFilter: filterValue,
    };

    const { error } = await supabase
      .from('users')
      .update({
        preferences: updatedPreferences,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) {
      console.error('Error saving page filter:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in savePageFilter:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Clear user preferences (reset to defaults)
 */
export async function clearUserPreferences(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from('users')
      .update({
        preferences: {},
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) {
      console.error('Error clearing user preferences:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in clearUserPreferences:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
