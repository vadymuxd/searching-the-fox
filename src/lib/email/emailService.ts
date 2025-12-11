import { Job } from '@/types/job';
import { renderEmailTemplate } from './renderEmailTemplate';

// Sender email - configure this in your Maileroo account
const SENDER_EMAIL = 'noreply@search-the-fox.com'; // Change to your verified domain
const SENDER_NAME = 'Search The Fox';

// Maileroo API configuration
const MAILEROO_API_URL = 'https://smtp.maileroo.com/send';

export interface SendJobEmailParams {
  to: string;
  jobs: Job[];
  userName?: string;
}

/**
 * Send job notification email to a user via Maileroo
 */
export async function sendJobEmail({
  to,
  jobs,
  userName,
}: SendJobEmailParams): Promise<{ success: boolean; error?: string; messageId?: string }> {
  try {
    // Debug logging
    console.log('Checking MAILEROO_API_KEY...');
    console.log('Available env vars:', Object.keys(process.env).filter(k => k.includes('MAILEROO') || k.includes('NEXT')));
    
    if (!process.env.MAILEROO_API_KEY) {
      console.error('MAILEROO_API_KEY is not configured');
      return {
        success: false,
        error: 'Email service is not configured. Please add MAILEROO_API_KEY to environment variables.',
      };
    }

    const jobCount = jobs.length;
    const subject = jobCount === 0 
      ? 'No New Jobs This Time'
      : `${jobCount} New Job${jobCount !== 1 ? 's' : ''} Matching Your Criteria`;

    const htmlContent = renderEmailTemplate(jobs, to);

    // Send email via Maileroo API
    const response = await fetch(MAILEROO_API_URL, {
      method: 'POST',
      headers: {
        'X-API-Key': process.env.MAILEROO_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: {
          email: SENDER_EMAIL,
          name: SENDER_NAME,
        },
        to: [
          {
            email: to,
            name: userName || to.split('@')[0],
          },
        ],
        subject: subject,
        html: htmlContent,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      console.error('Error sending email via Maileroo:', errorData);
      return {
        success: false,
        error: errorData.message || errorData.error || 'Failed to send email',
      };
    }

    const result = await response.json();
    const messageId = result.message_id || result.id;

    console.log('Email sent successfully via Maileroo:', messageId);
    return {
      success: true,
      messageId: messageId,
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
