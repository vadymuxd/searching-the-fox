'use server';

import { createClient } from '@/lib/supabase/server';
import { Job } from '@/types/job';

/**
 * Converts date_posted to ISO string, falling back to today's date if NULL or invalid
 * @param datePosted - The date_posted value from the job
 * @returns ISO string date or null
 */
function getDatePostedOrToday(datePosted: string | null | undefined): string {
  // If date_posted is provided and valid, use it
  if (datePosted) {
    try {
      const date = new Date(datePosted);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    } catch {
      // Fall through to use today's date
    }
  }
  
  // If date_posted is NULL or invalid, use today's date
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Set to start of day for consistency
  return today.toISOString();
}

/**
 * Maps frontend Job type to database jobs table structure
 */
function mapJobToDatabase(job: Job) {
  return {
    // Core job information
    title: job.title,
    company: job.company,
    company_url: job.company_url || null,
    company_logo_url: job.company_logo_url || null,
    job_url: job.job_url,
    location: job.location,
    
    // Job details
    is_remote: job.is_remote || false,
    description: job.description || null,
    job_type: job.job_type || null,
    job_function: job.job_function || null,
    job_level: job.job_level || null,
    
    // Salary information
    salary_min: job.salary_min ?? null,
    salary_max: job.salary_max ?? null,
    salary_currency: job.salary_currency || 'USD',
    
    // Company information
    company_industry: job.company_industry || null,
    
    // Additional fields
    // If date_posted is NULL or invalid, assign today's date
    date_posted: getDatePostedOrToday(job.date_posted),
    
    // Metadata (required field)
    site: job.source_site?.toLowerCase() || 'unknown',
    source_site: job.source_site || null,
  };
}

/**
 * Helper function to process array in batches
 */
function batchArray<T>(array: T[], batchSize: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < array.length; i += batchSize) {
    batches.push(array.slice(i, i + batchSize));
  }
  return batches;
}

/**
 * Save jobs to database and create user_jobs entries
 * Handles large batches by processing in chunks to avoid query limits
 * Returns the number of jobs saved
 */
export async function saveJobsToDatabase(
  jobs: Job[],
  userId: string
): Promise<{ success: boolean; jobsSaved: number; error?: string }> {
  try {
    const supabase = await createClient();
    
    if (!userId) {
      console.error('[saveJobsToDatabase] No user ID provided');
      return { success: false, jobsSaved: 0, error: 'User ID is required' };
    }

    if (!jobs || jobs.length === 0) {
      console.warn('[saveJobsToDatabase] No jobs provided to save');
      return { success: true, jobsSaved: 0 };
    }

    console.log(`[saveJobsToDatabase] Starting to save ${jobs.length} jobs for user ${userId}`);
    
    // Test Supabase connection
    console.log('[saveJobsToDatabase] Testing Supabase connection...');
    const { error: testError } = await supabase.from('jobs').select('id').limit(1);
    if (testError) {
      console.error('[saveJobsToDatabase] ❌ Supabase connection test FAILED:', testError);
      return { success: false, jobsSaved: 0, error: `Database connection failed: ${testError.message}` };
    }
    console.log('[saveJobsToDatabase] ✅ Supabase connection test passed');

    // Batch size for Supabase queries - very conservative to avoid issues
    // Start with 50 to be extra safe, can increase if successful
    const BATCH_SIZE = 50;
    
    console.log(`[saveJobsToDatabase] Using batch size: ${BATCH_SIZE}`);
    
    // Get existing jobs by job_url to avoid duplicates
    // Process in batches if there are many jobs
    const jobUrls = jobs.map(j => j.job_url);
    
    // Validate job URLs
    const invalidUrls = jobUrls.filter(url => !url || typeof url !== 'string' || url.trim() === '');
    if (invalidUrls.length > 0) {
      console.error('[saveJobsToDatabase] Found jobs with invalid URLs:', invalidUrls.length);
      return { success: false, jobsSaved: 0, error: `${invalidUrls.length} jobs have invalid URLs` };
    }
    
    console.log(`[saveJobsToDatabase] All ${jobUrls.length} job URLs validated`);
    
    const jobUrlBatches = batchArray(jobUrls, BATCH_SIZE);
    
    console.log(`[saveJobsToDatabase] Checking ${jobUrls.length} URLs in ${jobUrlBatches.length} batches`);
    
    const allExistingJobs: Array<{ id: string; job_url: string }> = [];
    
    for (let i = 0; i < jobUrlBatches.length; i++) {
      const urlBatch = jobUrlBatches[i];
      console.log(`[saveJobsToDatabase] Checking batch ${i + 1}/${jobUrlBatches.length} (${urlBatch.length} URLs)`);
      
      try {
        const { data, error: fetchError } = await supabase
          .from('jobs')
          .select('id, job_url')
          .in('job_url', urlBatch);

        if (fetchError) {
          console.error(`[saveJobsToDatabase] Error fetching existing jobs batch ${i + 1}:`, fetchError);
          console.error(`[saveJobsToDatabase] Error details:`, JSON.stringify(fetchError, null, 2));
          console.error(`[saveJobsToDatabase] Batch had ${urlBatch.length} URLs`);
          console.error(`[saveJobsToDatabase] First URL in batch:`, urlBatch[0]);
          return { success: false, jobsSaved: 0, error: `Failed to check existing jobs: ${fetchError.message}` };
        }

        if (data) {
          allExistingJobs.push(...data);
        }
      } catch (err) {
        console.error(`[saveJobsToDatabase] Unexpected error in batch ${i + 1}:`, err);
        return { success: false, jobsSaved: 0, error: `Unexpected error checking jobs: ${err instanceof Error ? err.message : String(err)}` };
      }
    }

    const existingJobUrls = new Set(allExistingJobs.map(j => j.job_url));
    const existingJobMap = new Map(allExistingJobs.map(j => [j.job_url, j.id]));

    console.log(`[saveJobsToDatabase] Found ${allExistingJobs.length} existing jobs in database`);

    // Split jobs into new and existing
    const newJobs = jobs.filter(j => !existingJobUrls.has(j.job_url));
    const existingJobsFromList = jobs.filter(j => existingJobUrls.has(j.job_url));

    console.log(`[saveJobsToDatabase] ${newJobs.length} new jobs to insert, ${existingJobsFromList.length} already exist`);

    const allJobIds: string[] = [];

    // Insert new jobs in batches
    if (newJobs.length > 0) {
      const jobBatches = batchArray(newJobs, BATCH_SIZE);
      
      console.log(`[saveJobsToDatabase] Inserting ${newJobs.length} new jobs in ${jobBatches.length} batches`);
      
      for (let i = 0; i < jobBatches.length; i++) {
        const batch = jobBatches[i];
        const jobsToInsert = batch.map(mapJobToDatabase);
        
        console.log(`[saveJobsToDatabase] Inserting batch ${i + 1}/${jobBatches.length} (${jobsToInsert.length} jobs)`);
        
        const { data: insertedJobs, error: insertError } = await supabase
          .from('jobs')
          .insert(jobsToInsert)
          .select('id, job_url');

        if (insertError) {
          console.error(`[saveJobsToDatabase] Error inserting jobs batch ${i + 1}:`, insertError);
          console.error('[saveJobsToDatabase] Sample job from failed batch:', jobsToInsert[0]);
          return { success: false, jobsSaved: 0, error: `Failed to insert jobs (batch ${i + 1}): ${insertError.message}` };
        }

        if (insertedJobs) {
          allJobIds.push(...insertedJobs.map(j => j.id));
          console.log(`[saveJobsToDatabase] Batch ${i + 1} inserted successfully, got ${insertedJobs.length} IDs`);
        }
      }
    }

    // Add existing job IDs
    existingJobsFromList.forEach(job => {
      const jobId = existingJobMap.get(job.job_url);
      if (jobId) {
        allJobIds.push(jobId);
      }
    });

    console.log(`[saveJobsToDatabase] Total job IDs to process: ${allJobIds.length}`);

    // Check which user_jobs entries already exist (process in batches)
    const jobIdBatches = batchArray(allJobIds, BATCH_SIZE);
    const allExistingUserJobs: Array<{ job_id: string }> = [];
    
    console.log(`[saveJobsToDatabase] Checking existing user_jobs in ${jobIdBatches.length} batches`);
    
    for (let i = 0; i < jobIdBatches.length; i++) {
      const idBatch = jobIdBatches[i];
      const { data, error: userJobsFetchError } = await supabase
        .from('user_jobs')
        .select('job_id')
        .eq('user_id', userId)
        .in('job_id', idBatch);

      if (userJobsFetchError) {
        console.error(`[saveJobsToDatabase] Error fetching existing user_jobs batch ${i + 1}:`, userJobsFetchError);
        // Continue with next batch instead of failing completely
        continue;
      }

      if (data) {
        allExistingUserJobs.push(...data);
      }
    }

    const existingUserJobIds = new Set(allExistingUserJobs.map(uj => uj.job_id));
    const newUserJobIds = allJobIds.filter(id => !existingUserJobIds.has(id));

    console.log(`[saveJobsToDatabase] ${newUserJobIds.length} new user_jobs entries to create, ${existingUserJobIds.size} already exist`);

    // Create user_jobs entries for new associations (in batches)
    if (newUserJobIds.length > 0) {
      const userJobIdBatches = batchArray(newUserJobIds, BATCH_SIZE);
      
      console.log(`[saveJobsToDatabase] Creating user_jobs entries in ${userJobIdBatches.length} batches`);
      
      for (let i = 0; i < userJobIdBatches.length; i++) {
        const batch = userJobIdBatches[i];
        const userJobsToInsert = batch.map(jobId => ({
          user_id: userId,
          job_id: jobId,
          status: 'new' as const,
        }));

        console.log(`[saveJobsToDatabase] Inserting user_jobs batch ${i + 1}/${userJobIdBatches.length} (${userJobsToInsert.length} entries)`);

        const { error: userJobsError } = await supabase
          .from('user_jobs')
          .insert(userJobsToInsert);

        if (userJobsError) {
          console.error(`[saveJobsToDatabase] Error inserting user_jobs batch ${i + 1}:`, userJobsError);
          return { success: false, jobsSaved: 0, error: `Failed to create user_jobs (batch ${i + 1}): ${userJobsError.message}` };
        }
        
        console.log(`[saveJobsToDatabase] User_jobs batch ${i + 1} inserted successfully`);
      }
    }

    console.log(`[saveJobsToDatabase] ✅ Successfully saved ${allJobIds.length} jobs total`);

    return {
      success: true,
      jobsSaved: allJobIds.length,
    };
  } catch (error) {
    console.error('[saveJobsToDatabase] ❌ Unexpected error:', error);
    return {
      success: false,
      jobsSaved: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get jobs for a specific user from database with prioritized fetching
 * Priority order: interested/applied/progressed -> new -> rejected -> archived
 * Maximum 1000 jobs total
 * Returns jobs with user_jobs metadata (status, notes, etc.)
 */
export async function getUserJobs(
  userId: string,
  status?: string
): Promise<{ success: boolean; jobs: Job[]; error?: string }> {
  try {
    const supabase = await createClient();

    // If a specific status is requested, fetch only that status
    if (status) {
      const query = supabase
        .from('user_jobs')
        .select(`
          id,
          status,
          notes,
          created_at,
          updated_at,
          jobs (
            id,
            title,
            company,
            company_url,
            company_logo_url,
            job_url,
            location,
            is_remote,
            description,
            job_type,
            job_function,
            job_level,
            salary_min,
            salary_max,
            salary_currency,
            company_industry,
            date_posted,
            source_site,
            site
          )
        `)
        .eq('user_id', userId)
        .eq('status', status)
        .order('created_at', { ascending: false })
        .limit(1000);

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching user jobs:', error);
        return { success: false, jobs: [], error: error.message };
      }

      // Transform the data to match Job type with additional user_jobs fields
      const jobs = (data?.map(item => ({
        ...(Array.isArray(item.jobs) ? item.jobs[0] : item.jobs),
        user_job_id: item.id,
        status: item.status,
        notes: item.notes,
        user_created_at: item.created_at,
        user_updated_at: item.updated_at,
      })) || []) as Job[];

      return {
        success: true,
        jobs,
      };
    }

    // Fetch jobs in priority order to reach 1000 total
    const MAX_JOBS = 1000;
    const allJobs: Job[] = [];
    
    // Define priority order: interested, applied, progressed, new, rejected, archived
    const priorityStatuses = [
      ['interested', 'applied', 'progressed'], // High priority
      ['new'], // Medium priority
      ['rejected'], // Low priority
      ['archived'] // Lowest priority
    ];

    // Base query template
    const createQuery = (statuses: string[], limit: number) => {
      return supabase
        .from('user_jobs')
        .select(`
          id,
          status,
          notes,
          created_at,
          updated_at,
          jobs (
            id,
            title,
            company,
            company_url,
            company_logo_url,
            job_url,
            location,
            is_remote,
            description,
            job_type,
            job_function,
            job_level,
            salary_min,
            salary_max,
            salary_currency,
            company_industry,
            date_posted,
            created_at,
            source_site,
            site
          )
        `)
        .eq('user_id', userId)
        .in('status', statuses)
        .order('created_at', { ascending: false })
        .limit(limit);
    };

    // Fetch jobs in priority order
    for (const statusGroup of priorityStatuses) {
      if (allJobs.length >= MAX_JOBS) {
        break;
      }

      const remainingLimit = MAX_JOBS - allJobs.length;
      const { data, error } = await createQuery(statusGroup, remainingLimit);

      if (error) {
        console.error(`Error fetching jobs for statuses ${statusGroup.join(', ')}:`, error);
        // Continue with next priority group even if this one fails
        continue;
      }

      if (data && data.length > 0) {
        // Transform and add jobs to the result
        const transformedJobs = data.map(item => ({
          ...(Array.isArray(item.jobs) ? item.jobs[0] : item.jobs),
          user_job_id: item.id,
          status: item.status,
          notes: item.notes,
          user_created_at: item.created_at,
          user_updated_at: item.updated_at,
        })) as Job[];

        allJobs.push(...transformedJobs);
      }
    }

    return {
      success: true,
      jobs: allJobs,
    };
  } catch (error) {
    console.error('Error in getUserJobs:', error);
    return {
      success: false,
      jobs: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Update job status for a user
 */
export async function updateJobStatus(
  userJobId: string,
  status: 'new' | 'interested' | 'applied' | 'progressed' | 'rejected' | 'archived',
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    const updateData: Record<string, string> = {
      status,
      updated_at: new Date().toISOString(),
    };

    // Update notes if provided
    if (notes !== undefined) {
      updateData.notes = notes;
    }

    const { error } = await supabase
      .from('user_jobs')
      .update(updateData)
      .eq('id', userJobId);

    if (error) {
      console.error('Error updating job status:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in updateJobStatus:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Delete a user_job entry (removes job from user's list)
 */
export async function removeUserJob(
  userJobId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from('user_jobs')
      .delete()
      .eq('id', userJobId);

    if (error) {
      console.error('Error removing user job:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in removeUserJob:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get job counts by status for a user
 */
export async function getUserJobCounts(
  userId: string
): Promise<{ success: boolean; counts: Record<string, number>; error?: string }> {
  try {
    const supabase = await createClient();

    // Get counts for each status
    const { data, error } = await supabase
      .from('user_jobs')
      .select('status')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching user job counts:', error);
      return { success: false, counts: {}, error: error.message };
    }

    // Count jobs by status
    const counts = data?.reduce((acc: Record<string, number>, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {}) || {};

    // Add total count for 'all'
    counts.all = data?.length || 0;

    return {
      success: true,
      counts,
    };
  } catch (error) {
    console.error('Error in getUserJobCounts:', error);
    return {
      success: false,
      counts: {},
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
