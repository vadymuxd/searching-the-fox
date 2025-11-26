import { Resend } from 'resend';
import { Job } from '@/types/job';
import { renderEmailTemplate } from './renderEmailTemplate';

// Sender email - change this after verifying your domain in Resend
const SENDER_EMAIL = 'onboarding@resend.dev'; // Default test email
// After domain verification, use: 'noreply@searching-the-fox.vercel.app'

export interface SendJobEmailParams {
  to: string;
  jobs: Job[];
  userName?: string;
}

/**
 * Send job notification email to a user
 */
export async function sendJobEmail({
  to,
  jobs,
  userName,
}: SendJobEmailParams): Promise<{ success: boolean; error?: string; messageId?: string }> {
  try {
    // Debug logging
    console.log('Checking RESEND_API_KEY...');
    console.log('Available env vars:', Object.keys(process.env).filter(k => k.includes('RESEND') || k.includes('NEXT')));
    
    if (!process.env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY is not configured');
      return {
        success: false,
        error: 'Email service is not configured. Please add RESEND_API_KEY to environment variables.',
      };
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    const jobCount = jobs.length;
    const subject = jobCount === 0 
      ? 'No New Jobs This Time'
      : `${jobCount} New Job${jobCount !== 1 ? 's' : ''} Matching Your Criteria`;

    const htmlContent = renderEmailTemplate(jobs, to);

    const { data, error } = await resend.emails.send({
      from: SENDER_EMAIL,
      to: [to],
      subject: subject,
      html: htmlContent,
    });

    if (error) {
      console.error('Error sending email via Resend:', error);
      return {
        success: false,
        error: error.message || 'Failed to send email',
      };
    }

    console.log('Email sent successfully:', data?.id);
    return {
      success: true,
      messageId: data?.id,
    };
  } catch (error) {
    console.error('Error in sendJobEmail:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send job notification emails to multiple users
 */
export async function sendBulkJobEmails(
  recipients: SendJobEmailParams[]
): Promise<{ success: boolean; sent: number; failed: number; errors: string[] }> {
  const results = await Promise.allSettled(
    recipients.map((recipient) => sendJobEmail(recipient))
  );

  const sent = results.filter((r) => r.status === 'fulfilled' && r.value.success).length;
  const failed = results.length - sent;
  const errors: string[] = results
    .filter((r) => r.status === 'fulfilled' && !r.value.success)
    .map((r) => (r as PromiseFulfilledResult<{ success: boolean; error?: string }>).value.error || 'Unknown error');

  return {
    success: failed === 0,
    sent,
    failed,
    errors,
  };
}
