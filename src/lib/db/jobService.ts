'use server';

import { createClient } from '@/lib/supabase/server';
import { Job } from '@/types/job';

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
    date_posted: job.date_posted ? (() => {
      try {
        const date = new Date(job.date_posted);
        return isNaN(date.getTime()) ? null : date.toISOString();
      } catch {
        return null;
      }
    })() : null,
    
    // Metadata (required field)
    site: job.source_site?.toLowerCase() || 'unknown',
    source_site: job.source_site || null,
  };
}

/**
 * Save jobs to database and create user_jobs entries
 * Returns the number of jobs saved
 */
export async function saveJobsToDatabase(
  jobs: Job[],
  userId: string
): Promise<{ success: boolean; jobsSaved: number; error?: string }> {
  try {
    const supabase = await createClient();
    
    if (!userId) {
      return { success: false, jobsSaved: 0, error: 'User ID is required' };
    }

    // Get existing jobs by job_url to avoid duplicates
    const jobUrls = jobs.map(j => j.job_url);
    const { data: existingJobs, error: fetchError } = await supabase
      .from('jobs')
      .select('id, job_url')
      .in('job_url', jobUrls);

    if (fetchError) {
      console.error('Error fetching existing jobs:', fetchError);
      return { success: false, jobsSaved: 0, error: fetchError.message };
    }

    const existingJobUrls = new Set(existingJobs?.map(j => j.job_url) || []);
    const existingJobMap = new Map(existingJobs?.map(j => [j.job_url, j.id]) || []);

    // Split jobs into new and existing
    const newJobs = jobs.filter(j => !existingJobUrls.has(j.job_url));
    const existingJobsFromList = jobs.filter(j => existingJobUrls.has(j.job_url));

    let allJobIds: string[] = [];

    // Insert new jobs
    if (newJobs.length > 0) {
      const jobsToInsert = newJobs.map(mapJobToDatabase);
      
      const { data: insertedJobs, error: insertError } = await supabase
        .from('jobs')
        .insert(jobsToInsert)
        .select('id, job_url');

      if (insertError) {
        console.error('Error inserting jobs:', insertError);
        return { success: false, jobsSaved: 0, error: insertError.message };
      }

      allJobIds = insertedJobs?.map(j => j.id) || [];
    }

    // Add existing job IDs
    existingJobsFromList.forEach(job => {
      const jobId = existingJobMap.get(job.job_url);
      if (jobId) {
        allJobIds.push(jobId);
      }
    });

    // Check which user_jobs entries already exist
    const { data: existingUserJobs, error: userJobsFetchError } = await supabase
      .from('user_jobs')
      .select('job_id')
      .eq('user_id', userId)
      .in('job_id', allJobIds);

    if (userJobsFetchError) {
      console.error('Error fetching existing user_jobs:', userJobsFetchError);
    }

    const existingUserJobIds = new Set(existingUserJobs?.map(uj => uj.job_id) || []);
    const newUserJobIds = allJobIds.filter(id => !existingUserJobIds.has(id));

    // Create user_jobs entries for new associations
    if (newUserJobIds.length > 0) {
      const userJobsToInsert = newUserJobIds.map(jobId => ({
        user_id: userId,
        job_id: jobId,
        status: 'new' as const,
      }));

      const { error: userJobsError } = await supabase
        .from('user_jobs')
        .insert(userJobsToInsert);

      if (userJobsError) {
        console.error('Error inserting user_jobs:', userJobsError);
        return { success: false, jobsSaved: 0, error: userJobsError.message };
      }
    }

    return {
      success: true,
      jobsSaved: allJobIds.length,
    };
  } catch (error) {
    console.error('Error in saveJobsToDatabase:', error);
    return {
      success: false,
      jobsSaved: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get jobs for a specific user from database
 * Returns jobs with user_jobs metadata (status, notes, etc.)
 */
export async function getUserJobs(
  userId: string,
  status?: string
): Promise<{ success: boolean; jobs: any[]; error?: string }> {
  try {
    const supabase = await createClient();

    let query = supabase
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
      .order('created_at', { ascending: false });

    // Filter by status if provided
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching user jobs:', error);
      return { success: false, jobs: [], error: error.message };
    }

    // Transform the data to match Job type with additional user_jobs fields
    const jobs = data?.map(item => ({
      ...item.jobs,
      user_job_id: item.id,
      status: item.status,
      notes: item.notes,
      user_created_at: item.created_at,
      user_updated_at: item.updated_at,
    })) || [];

    return {
      success: true,
      jobs,
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

    const updateData: any = {
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
