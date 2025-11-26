import { Job } from '@/types/job';

/**
 * Renders the email template HTML server-side
 * This is the same template as /email-template page but rendered as a string
 */
export function renderEmailTemplate(jobs: Job[], userEmail: string): string {
  const jobCount = jobs.length;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Job Opportunities</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f8f9fa;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    
    <!-- Logo Header -->
    <div style="background-color: #ffffff; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
      <a href="https://searching-the-fox.vercel.app/results" target="_blank" style="text-decoration: none; display: inline-block;">
        <img src="https://searching-the-fox.vercel.app/favicon.png" alt="Searching The Fox" style="height: 60px; width: auto; margin-bottom: 8px;" />
      </a>
      <p style="color: #495057; margin: 0; font-size: 14px;">
        ${jobCount} new job${jobCount !== 1 ? 's' : ''} available
      </p>
    </div>

    <!-- Jobs List -->
    <div style="background-color: #ffffff; padding: 10px;">
      ${jobCount === 0 ? `
        <div style="padding: 40px 20px; text-align: center; color: #868e96;">
          <p style="margin: 0;">No new jobs found.</p>
        </div>
      ` : jobs.map(job => `
        <div style="background-color: #ffffff; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; margin-bottom: 15px;">
          
          <!-- Company Info Row -->
          <div style="display: flex; align-items: center; margin-bottom: 12px;">
            ${job.company_logo_url ? `
              <img src="${job.company_logo_url}" alt="${job.company} logo" style="width: 50px; height: 50px; object-fit: contain; margin-right: 15px; border-radius: 6px; border: 1px solid #e9ecef;" />
            ` : `
              <div style="width: 50px; height: 50px; background-color: #f1f3f5; margin-right: 15px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: bold; color: #adb5bd;">
                ${job.company.charAt(0).toUpperCase()}
              </div>
            `}
            
            <div>
              <h3 style="margin: 0 0 4px 0; font-size: 16px; font-weight: 600; color: #212529;">
                ${job.company}
              </h3>
              ${job.location ? `
                <p style="margin: 0; font-size: 13px; color: #868e96;">
                  📍 ${job.location}
                </p>
              ` : ''}
            </div>
          </div>

          <!-- Job Title -->
          <h2 style="margin: 0 0 12px 0; font-size: 20px; font-weight: bold; color: #1971c2; line-height: 1.3;">
            ${job.title}
          </h2>

          <!-- Job Details -->
          <div style="margin-bottom: 15px; font-size: 14px; color: #495057;">
            ${job.job_type ? `
              <span style="display: inline-block; background-color: #f1f3f5; padding: 4px 10px; border-radius: 4px; margin-right: 8px; font-size: 12px; text-transform: capitalize;">
                ${job.job_type}
              </span>
            ` : ''}
            ${job.is_remote ? `
              <span style="display: inline-block; background-color: #d0ebff; color: #1971c2; padding: 4px 10px; border-radius: 4px; margin-right: 8px; font-size: 12px; font-weight: 500;">
                Remote
              </span>
            ` : ''}
            ${job.salary_min && job.salary_max ? `
              <span style="display: inline-block; color: #2b8a3e; font-size: 13px; font-weight: 500;">
                ${job.salary_currency || '$'}${job.salary_min.toLocaleString()} - ${job.salary_currency || '$'}${job.salary_max.toLocaleString()}
              </span>
            ` : ''}
          </div>

          <!-- Description Preview -->
          ${job.description ? `
            <p style="margin: 0 0 15px 0; font-size: 14px; color: #495057; line-height: 1.5;">
              ${job.description.replace(/<[^>]*>/g, '').substring(0, 200)}...
            </p>
          ` : ''}

          <!-- View Job Button -->
          <a href="${job.job_url}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #228be6; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 600;">
            View Job Post →
          </a>

          <!-- Posted Date -->
          ${job.date_posted ? `
            <p style="margin: 12px 0 0 0; font-size: 12px; color: #868e96;">
              Posted: ${new Date(job.date_posted).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
            </p>
          ` : ''}
        </div>
      `).join('')}
    </div>

    <!-- Email Footer -->
    <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e9ecef; border-radius: 0 0 8px 8px;">
      <p style="margin: 0 0 10px 0; font-size: 13px; color: #868e96;">
        You received this email because you have job alerts enabled.
      </p>
      <p style="margin: 0; font-size: 12px; color: #adb5bd;">
        © 2025 Searching The Fox. All rights reserved.
      </p>
    </div>

  </div>
</body>
</html>
  `.trim();
}
