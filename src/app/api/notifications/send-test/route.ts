import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendJobEmail } from '@/lib/email/emailService';

/**
 * POST /api/notifications/send-test
 * Send a test email to the authenticated user
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!user.email) {
      return NextResponse.json(
        { error: 'User email not found' },
        { status: 400 }
      );
    }

    // 1. Get user's keywords
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('keywords')
      .eq('id', user.id)
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
      return NextResponse.json({
        success: false,
        error: 'No keywords configured. Please set up your job title keywords first.',
      });
    }

    // 2. Get NEW jobs for this user
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
          source_site,
          site
        )
      `)
      .eq('user_id', user.id)
      .eq('status', 'new')
      .order('created_at', { ascending: false });

    if (jobsError) {
      console.error('Error fetching jobs:', jobsError);
      return NextResponse.json(
        { error: 'Failed to fetch jobs' },
        { status: 500 }
      );
    }

    // 3. Filter jobs by keywords
    const filteredJobs = (userJobs || [])
      .filter((userJob) => {
        const job = Array.isArray(userJob.jobs) ? userJob.jobs[0] : userJob.jobs;
        if (!job || !job.title) return false;

        const jobTitle = job.title.toLowerCase();
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

    // 4. Send email
    const result = await sendJobEmail({
      to: user.email,
      jobs: filteredJobs,
      userName: user.email.split('@')[0],
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to send email' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Test email sent to ${user.email}`,
      jobCount: filteredJobs.length,
      messageId: result.messageId,
    });
  } catch (error) {
    console.error('Error in send-test API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
