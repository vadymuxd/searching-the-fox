import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/email-jobs?userId=xxx
 * Fetch NEW jobs filtered by user's keywords (hidden from email display)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // 1. Get user's keywords
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('keywords')
      .eq('id', userId)
      .single();

    if (userError) {
      console.error('Error fetching user keywords:', userError);
      return NextResponse.json(
        { error: 'Failed to fetch user keywords' },
        { status: 500 }
      );
    }

    const keywords = userData?.keywords || [];

    if (keywords.length === 0) {
      // No keywords = no filtering, return empty array
      return NextResponse.json({
        success: true,
        jobs: [],
        total: 0,
        message: 'No keywords configured for user',
      });
    }

    // 2. Get NEW jobs for this user (no limit)
    const { data: userJobs, error: jobsError } = await supabase
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
      .eq('status', 'new')
      .order('created_at', { ascending: false });

    if (jobsError) {
      console.error('Error fetching jobs:', jobsError);
      return NextResponse.json(
        { error: 'Failed to fetch jobs' },
        { status: 500 }
      );
    }

    // 3. Filter jobs by keywords (case-insensitive match in job title)
    const filteredJobs = (userJobs || [])
      .filter((userJob) => {
        const job = Array.isArray(userJob.jobs) ? userJob.jobs[0] : userJob.jobs;
        if (!job || !job.title) return false;

        const jobTitle = job.title.toLowerCase();
        // Check if any keyword is present in the job title
        return keywords.some((keyword: string) =>
          jobTitle.includes(keyword.toLowerCase())
        );
      })
      .map((userJob) => {
        const job = Array.isArray(userJob.jobs) ? userJob.jobs[0] : userJob.jobs;
        return {
          ...job,
          user_job_id: userJob.id,
          status: userJob.status,
          notes: userJob.notes,
          user_created_at: userJob.created_at,
          user_updated_at: userJob.updated_at,
        };
      });

    return NextResponse.json({
      success: true,
      jobs: filteredJobs,
      total: filteredJobs.length,
    });
  } catch (error) {
    console.error('Error in email-jobs API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
