import { createClient as createBrowserClient } from '@/lib/supabase/client';
import { SupabaseClient } from '@supabase/supabase-js';

// Types for search runs
export type SearchSource = 'manual' | 'cron';
export type SearchRunStatus = 'pending' | 'running' | 'success' | 'failed';

export interface SearchRunParameters {
  jobTitle: string;
  location: string;
  site: string;
  hours_old?: number;
  results_wanted?: number;
  country_indeed?: string;
}

export interface ClientContext {
  userAgent?: string;
  device?: string;
  timestamp?: string;
  [key: string]: any;
}

export interface SearchRun {
  id: string;
  user_id: string;
  source: SearchSource;
  client_context?: ClientContext;
  parameters: SearchRunParameters;
  status: SearchRunStatus;
  error_message?: string;
  jobs_found?: number;
  created_at: string;
  updated_at: string;
  started_at?: string;
  completed_at?: string;
}

export interface CreateSearchRunParams {
  userId: string;
  parameters: SearchRunParameters;
  source?: SearchSource;
  clientContext?: ClientContext;
}

export interface UpdateSearchRunStatusParams {
  runId: string;
  status: SearchRunStatus;
  error?: string;
  jobsFound?: number;
  startedAt?: string;
  completedAt?: string;
}

/**
 * Creates a new search run in the database
 * @param params - Parameters for creating the search run
 * @param supabase - Optional Supabase client (defaults to browser client)
 * @returns The created search run or null if failed
 */
export async function createSearchRun(
  params: CreateSearchRunParams,
  supabase?: SupabaseClient
): Promise<SearchRun | null> {
  try {
    const client = supabase || createBrowserClient();
    
    const { data, error } = await client
      .from('search_runs')
      .insert({
        user_id: params.userId,
        source: params.source || 'manual',
        client_context: params.clientContext || null,
        parameters: params.parameters,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating search run:', error);
      return null;
    }

    return data as SearchRun;
  } catch (error) {
    console.error('Exception creating search run:', error);
    return null;
  }
}

/**
 * Updates the status of a search run
 * @param params - Parameters for updating the search run
 * @param supabase - Optional Supabase client (defaults to browser client)
 * @returns The updated search run or null if failed
 */
export async function updateSearchRunStatus(
  params: UpdateSearchRunStatusParams,
  supabase?: SupabaseClient
): Promise<SearchRun | null> {
  try {
    const client = supabase || createBrowserClient();
    
    const updateData: any = {
      status: params.status,
    };

    // Add optional fields if provided
    if (params.error !== undefined) {
      updateData.error_message = params.error;
    }
    
    if (params.jobsFound !== undefined) {
      updateData.jobs_found = params.jobsFound;
    }

    if (params.startedAt !== undefined) {
      updateData.started_at = params.startedAt;
    }

    if (params.completedAt !== undefined) {
      updateData.completed_at = params.completedAt;
    }

    // Auto-set started_at when status changes to 'running'
    if (params.status === 'running' && !params.startedAt) {
      updateData.started_at = new Date().toISOString();
    }

    // Auto-set completed_at when status changes to 'success' or 'failed'
    if ((params.status === 'success' || params.status === 'failed') && !params.completedAt) {
      updateData.completed_at = new Date().toISOString();
    }

    const { data, error } = await client
      .from('search_runs')
      .update(updateData)
      .eq('id', params.runId)
      .select()
      .single();

    if (error) {
      console.error('Error updating search run:', error);
      return null;
    }

    return data as SearchRun;
  } catch (error) {
    console.error('Exception updating search run:', error);
    return null;
  }
}

/**
 * Retrieves a single search run by ID
 * @param runId - The ID of the search run to retrieve
 * @param supabase - Optional Supabase client (defaults to browser client)
 * @returns The search run or null if not found
 */
export async function getSearchRun(
  runId: string,
  supabase?: SupabaseClient
): Promise<SearchRun | null> {
  try {
    const client = supabase || createBrowserClient();
    
    const { data, error } = await client
      .from('search_runs')
      .select('*')
      .eq('id', runId)
      .single();

    if (error) {
      console.error('Error getting search run:', error);
      return null;
    }

    return data as SearchRun;
  } catch (error) {
    console.error('Exception getting search run:', error);
    return null;
  }
}

/**
 * Retrieves recent search runs for a user
 * @param userId - The ID of the user
 * @param limit - Maximum number of runs to retrieve (default: 10)
 * @param supabase - Optional Supabase client (defaults to browser client)
 * @returns Array of search runs
 */
export async function getUserSearchRuns(
  userId: string,
  limit: number = 10,
  supabase?: SupabaseClient
): Promise<SearchRun[]> {
  try {
    const client = supabase || createBrowserClient();
    
    const { data, error } = await client
      .from('search_runs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error getting user search runs:', error);
      return [];
    }

    return (data || []) as SearchRun[];
  } catch (error) {
    console.error('Exception getting user search runs:', error);
    return [];
  }
}

/**
 * Gets the most recent active (pending or running) search run for a user
 * @param userId - The ID of the user
 * @param supabase - Optional Supabase client (defaults to browser client for client-side use)
 * @returns The active search run or null if none found
 */
export async function getActiveSearchRun(
  userId: string,
  supabase?: SupabaseClient
): Promise<SearchRun | null> {
  try {
    const client = supabase || createBrowserClient();
    
    const { data, error } = await client
      .from('search_runs')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['pending', 'running'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      // No active search run found is not an error
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('Error getting active search run:', error);
      return null;
    }

    return data as SearchRun;
  } catch (error) {
    console.error('Exception getting active search run:', error);
    return null;
  }
}

/**
 * Subscribes to real-time updates for a specific search run
 * @param runId - The ID of the search run to monitor
 * @param callback - Function to call when the search run is updated
 * @param supabase - Optional Supabase client (defaults to browser client)
 * @returns Unsubscribe function
 */
export function subscribeToSearchRun(
  runId: string,
  callback: (searchRun: SearchRun) => void,
  supabase?: SupabaseClient
): () => void {
  const client = supabase || createBrowserClient();
  
  const channel = client
    .channel(`search_run:${runId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'search_runs',
        filter: `id=eq.${runId}`,
      },
      (payload) => {
        callback(payload.new as SearchRun);
      }
    )
    .subscribe();

  // Return unsubscribe function
  return () => {
    client.removeChannel(channel);
  };
}

/**
 * Gets the most recent successful search run for a user
 * Used by cron jobs to get last search criteria
 * @param userId - The ID of the user
 * @param supabase - Optional Supabase client (defaults to browser client)
 * @returns The most recent successful search run or null
 */
export async function getLastSuccessfulSearchRun(
  userId: string,
  supabase?: SupabaseClient
): Promise<SearchRun | null> {
  try {
    const client = supabase || createBrowserClient();
    
    const { data, error } = await client
      .from('search_runs')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'success')
      .order('completed_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      // No successful search run found is not an error
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('Error getting last successful search run:', error);
      return null;
    }

    return data as SearchRun;
  } catch (error) {
    console.error('Exception getting last successful search run:', error);
    return null;
  }
}
