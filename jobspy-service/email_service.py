"""
Email service for sending job notifications via Resend API
Mirrors the TypeScript emailService.ts functionality
"""

import os
import logging
from datetime import datetime, timezone
from typing import List, Dict, Optional, Any
import json
import resend

logger = logging.getLogger(__name__)

# Sender email - change this after verifying your domain in Resend
SENDER_EMAIL = 'onboarding@resend.dev'  # Default test email
# After domain verification, use: 'noreply@searching-the-fox.vercel.app'


def render_email_template(jobs: List[Dict], user_email: str) -> str:
    """
    Renders the email template HTML server-side
    Matches the TypeScript renderEmailTemplate.ts implementation
    """
    job_count = len(jobs)
    
    # Helper function to format date like JobTable component
    def format_posted_date(job: Dict) -> str:
        try:
            date_posted = job.get('date_posted')
            created_at = job.get('created_at')
            
            # Try date_posted first
            date_obj = None
            if date_posted and str(date_posted) not in ['Not specified', 'null', 'undefined', 'None', '']:
                try:
                    date_obj = datetime.fromisoformat(str(date_posted).replace('Z', '+00:00'))
                except:
                    pass
            
            # Fallback to created_at
            if not date_obj and created_at:
                try:
                    date_obj = datetime.fromisoformat(str(created_at).replace('Z', '+00:00'))
                except:
                    pass
            
            # Calculate relative time (use timezone-aware UTC dates to avoid naive/aware errors)
            if date_obj:
                # Ensure date_obj is timezone-aware in UTC
                if date_obj.tzinfo is None:
                    date_obj = date_obj.replace(tzinfo=timezone.utc)

                today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
                date_obj = date_obj.astimezone(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

                diff_days = (today - date_obj).days
                
                if diff_days == 0:
                    return 'Today'
                elif diff_days == 1:
                    return 'Yesterday'
                else:
                    return f'{diff_days} days ago'
            
            return 'Today'
        except Exception as e:
            logger.warning(f"Error formatting date: {e}")
            return 'Today'
    
    # Build job cards HTML
    jobs_html = ''
    if job_count == 0:
        jobs_html = '''
        <div style="padding: 40px 20px; text-align: center; color: #868e96;">
          <p style="margin: 0;">No new jobs found.</p>
        </div>
        '''
    else:
        for job in jobs:
            # Company logo or fallback
            if job.get('company_logo_url'):
                logo_html = f'''
              <img src="{job['company_logo_url']}" alt="{job.get('company', 'Company')} logo" style="width: 50px; height: 50px; object-fit: contain; margin-right: 15px; border-radius: 6px; border: 1px solid #e9ecef;" />
                '''
            else:
                company_initial = job.get('company', 'U')[0].upper()
                logo_html = f'''
              <div style="width: 50px; height: 50px; background-color: #f1f3f5; margin-right: 15px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: bold; color: #adb5bd;">
                {company_initial}
              </div>
                '''
            
            # Location (no pin emoji)
            location_html = ''
            if job.get('location'):
                location_html = f'''
                  <p style="margin: 0; font-size: 13px; color: #868e96;">
                    {job['location']}
                  </p>
                '''
            
            # Posted badge (no "Posted:" prefix)
            posted_text = format_posted_date(job)
            posted_html = f'''
                  <span style="display: inline-block; background-color: #f1f3f5; padding: 4px 10px; border-radius: 4px; margin-right: 8px; font-size: 12px;">
                    {posted_text}
                  </span>
                '''
            
            # Remote badge
            remote_html = ''
            if job.get('is_remote'):
                remote_html = '''
              <span style="display: inline-block; background-color: #d0ebff; color: #1971c2; padding: 4px 10px; border-radius: 4px; margin-right: 8px; font-size: 12px; font-weight: 500;">
                Remote
              </span>
                '''
            
            # Salary
            salary_html = ''
            if job.get('salary_min') and job.get('salary_max'):
                currency = job.get('salary_currency', '$')
                salary_min = f"{int(job['salary_min']):,}"
                salary_max = f"{int(job['salary_max']):,}"
                salary_html = f'''
              <span style="display: inline-block; color: #2b8a3e; font-size: 13px; font-weight: 500;">
                {currency}{salary_min} - {currency}{salary_max}
              </span>
                '''
            
            # Description preview
            description_html = ''
            if job.get('description'):
                # Strip HTML tags and truncate
                import re
                desc_text = re.sub('<[^>]*>', '', str(job['description']))
                if len(desc_text) > 200:
                    desc_text = desc_text[:197] + '...'
                description_html = f'''
            <p style="margin: 0 0 15px 0; font-size: 14px; color: #495057; line-height: 1.5;">
              {desc_text}
            </p>
                '''
            
            # Build single job card
            job_card = f'''
        <div style="background-color: #ffffff; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; margin-bottom: 15px;">
          
          <!-- Company Info Row -->
          <div style="display: flex; align-items: center; margin-bottom: 12px;">
            {logo_html}
            
            <div>
              <h3 style="margin: 0 0 4px 0; font-size: 16px; font-weight: 600; color: #212529;">
                {job.get('company', 'Unknown Company')}
              </h3>
              {location_html}
            </div>
          </div>

          <!-- Job Title (clickable) -->
          <h2 style="margin: 0 0 12px 0; font-size: 20px; font-weight: bold; color: #1971c2; line-height: 1.3;">
            <a href="{job.get('job_url', '#')}" target="_blank" rel="noopener noreferrer" style="color: inherit; text-decoration: none;">
              {job.get('title', 'No Title')}
            </a>
          </h2>

          <!-- Job Details -->
          <div style="margin-bottom: 15px; font-size: 14px; color: #495057;">
            {posted_html}
            {remote_html}
            {salary_html}
          </div>

          {description_html}
        </div>
            '''
            jobs_html += job_card
    
    # Full HTML template
    html = f'''
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
        {job_count} new job{'s' if job_count != 1 else ''} available
      </p>
    </div>

    <!-- Jobs List -->
    <div style="background-color: #ffffff; padding: 10px;">
      {jobs_html}
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
    '''
    
    return html.strip()


def send_job_email(to: str, jobs: List[Dict], user_name: Optional[str] = None) -> Dict:
    """
    Send job notification email to a user via Resend API
    
    Args:
        to: Recipient email address
        jobs: List of job dictionaries
        user_name: Optional user name for personalization
    """
    try:
        # Check if Resend API key is configured
        api_key = os.getenv('RESEND_API_KEY')
        if not api_key:
            return {
                'success': False,
                'error': 'Email service is not configured. Please add RESEND_API_KEY to environment variables.'
            }
        
        # Initialize Resend with API key
        resend.api_key = api_key
        
        job_count = len(jobs)
        subject = 'No New Jobs This Time' if job_count == 0 else f"{job_count} New Job{'s' if job_count != 1 else ''} Matching Your Criteria"
        
        html_content = render_email_template(jobs, to)
        
        # Send email via Resend
        params = {
            'from': SENDER_EMAIL,
            'to': [to],
            'subject': subject,
            'html': html_content,
        }
        
        response = resend.Emails.send(params)
        
        logger.info(f'Email sent successfully to {to}: {response.get("id")}')
        return {
            'success': True,
            'message_id': response.get('id')
        }
        
    except Exception as error:
        logger.error(f'Error sending email to {to}: {error}')
        return {
            'success': False,
            'error': str(error)
        }


def send_email_to_user(supabase_client, user_id: str) -> Dict:
    """
    Send job notification email to a specific user if they have email_notifications_enabled=true
    
    Args:
        supabase_client: Initialized Supabase client
        user_id: User ID to send email to
    
    Returns:
        dict with 'success' (bool), 'error' (str, optional), 'message_id' (str, optional)
    """
    if not supabase_client:
        logger.error("Supabase client not provided")
        return {
            'success': False,
            'error': 'Database not configured'
        }
    
    try:
        # 1. Get user data
        user_result = supabase_client.table('users') \
            .select('id, email, email_notifications_enabled, keywords') \
            .eq('id', user_id) \
            .single() \
            .execute()
        
        user = user_result.data if user_result.data else None
        
        if not user:
            logger.warning(f"User {user_id} not found")
            return {
                'success': False,
                'error': 'User not found'
            }
        
        user_email = user.get('email')
        email_enabled = user.get('email_notifications_enabled', False)

        # Normalize keywords to a proper list of strings
        raw_keywords: Any = user.get('keywords', [])
        keywords: List[str]
        if isinstance(raw_keywords, list):
            keywords = [str(k) for k in raw_keywords]
        elif isinstance(raw_keywords, str) and raw_keywords.strip():
            try:
                parsed = json.loads(raw_keywords)
                if isinstance(parsed, list):
                    keywords = [str(k) for k in parsed]
                else:
                    keywords = [raw_keywords]
            except Exception:
                keywords = [raw_keywords]
        else:
            keywords = []
        
        # 2. Check if email notifications are enabled
        if not email_enabled:
            logger.info(f"User {user_email} has email notifications disabled, skipping")
            return {
                'success': True,
                'skipped': True,
                'reason': 'notifications_disabled'
            }
        
        if not user_email:
            logger.warning(f"User {user_id} has no email address")
            return {
                'success': False,
                'error': 'No email address'
            }
        
        if not keywords or len(keywords) == 0:
            logger.info(f"User {user_email} has no keywords configured, skipping")
            return {
                'success': True,
                'skipped': True,
                'reason': 'no_keywords'
            }
        
        # 3. Get NEW user_jobs for this user (without join; Python client wasn't populating jobs(...))
        user_jobs_result = supabase_client.table('user_jobs') \
            .select('id, user_id, job_id, status, notes, created_at, updated_at') \
            .eq('user_id', user_id) \
            .eq('status', 'new') \
            .order('created_at', desc=True) \
            .execute()

        user_jobs = user_jobs_result.data if user_jobs_result.data else []

        # 3b. Fetch all related jobs in a separate query and map by id
        job_ids: List[str] = [uj.get('job_id') for uj in user_jobs if uj.get('job_id')]
        jobs_by_id: Dict[str, Dict] = {}

        if job_ids:
            try:
                jobs_result = supabase_client.table('jobs') \
                    .select('''
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
                        site,
                        created_at
                    ''') \
                    .in_('id', job_ids) \
                    .execute()

                for job in jobs_result.data or []:
                    if job.get('id'):
                        jobs_by_id[job['id']] = job
            except Exception as job_fetch_error:
                logger.error(f"[email_service] Error fetching jobs for user {user_email}: {job_fetch_error}")

        # Debug logging before filtering to mirror frontend behavior
        logger.info(
            f"[email_service] Preparing to filter jobs for user={user_email}, "
            f"raw_keywords={raw_keywords}, normalized_keywords={keywords}, "
            f"new_user_jobs_count={len(user_jobs)}, jobs_loaded={len(jobs_by_id)}"
        )

        # Log a few raw user_jobs and corresponding jobs to understand response shape
        for idx, sample in enumerate((user_jobs or [])[:5]):
            logger.info(f"[email_service] Sample user_job[{idx}] raw: {sample}")
            sample_job = jobs_by_id.get(sample.get('job_id')) if sample.get('job_id') else None
            logger.info(f"[email_service] Sample user_job[{idx}] joined job: {sample_job}")
            title_sample = sample_job.get('title') if isinstance(sample_job, dict) else None
            logger.info(f"[email_service] Sample user_job[{idx}] title before filtering: {title_sample}")

        # 4. Filter jobs by keywords using the SAME logic as send-test route:
        # case-insensitive substring match: jobTitle.toLowerCase().includes(keyword.toLowerCase())
        filtered_jobs: List[Dict] = []
        for user_job in (user_jobs or []):
            job_id = user_job.get('job_id')
            job = jobs_by_id.get(job_id) if job_id else None

            if not job or not job.get('title'):
                continue

            job_title_lower = str(job.get('title', '')).lower()

            matched_keyword: Optional[str] = None
            for k in keywords:
                keyword_str = str(k).strip()
                if not keyword_str:
                    continue
                if keyword_str.lower() in job_title_lower:
                    matched_keyword = keyword_str
                    break

            if matched_keyword is None:
                continue

            # Attach metadata to job as in the TS path
            job['user_job_id'] = user_job.get('id')
            job['status'] = user_job.get('status')
            job['notes'] = user_job.get('notes')
            job['user_created_at'] = user_job.get('created_at')
            job['user_updated_at'] = user_job.get('updated_at')

            filtered_jobs.append(job)

        logger.info(
            f"[email_service] Filtered jobs for user={user_email}: "
            f"matched_jobs={len(filtered_jobs)} out_of_total={len(user_jobs)}, "
            f"keywords_used={keywords}"
        )
        
        # 4b. Sort jobs by date_posted (newest first: Today -> Yesterday -> older dates)
        def get_job_sort_key(job: Dict) -> datetime:
            """Extract date for sorting, defaulting to epoch if not available"""
            try:
                date_posted = job.get('date_posted')
                if date_posted and str(date_posted) not in ['Not specified', 'null', 'undefined', 'None', '']:
                    date_obj = datetime.fromisoformat(str(date_posted).replace('Z', '+00:00'))
                    if date_obj.tzinfo is None:
                        date_obj = date_obj.replace(tzinfo=timezone.utc)
                    return date_obj
                
                # Fallback to created_at
                created_at = job.get('created_at')
                if created_at:
                    date_obj = datetime.fromisoformat(str(created_at).replace('Z', '+00:00'))
                    if date_obj.tzinfo is None:
                        date_obj = date_obj.replace(tzinfo=timezone.utc)
                    return date_obj
            except Exception as e:
                logger.warning(f"Error parsing date for sorting: {e}")
            
            # Default to epoch (oldest possible date)
            return datetime(1970, 1, 1, tzinfo=timezone.utc)
        
        # Sort in descending order (newest first)
        filtered_jobs.sort(key=get_job_sort_key, reverse=True)
        
        # 5. Send email
        result = send_job_email(
            to=user_email,
            jobs=filtered_jobs,
            user_name=user_email.split('@')[0]
        )
        
        if result.get('success'):
            logger.info(f"✓ Email sent to {user_email} ({len(filtered_jobs)} jobs)")
        else:
            logger.error(f"✗ Failed to send email to {user_email}: {result.get('error')}")
        
        return result
        
    except Exception as e:
        logger.error(f"Error sending email to user {user_id}: {e}")
        return {
            'success': False,
            'error': str(e)
        }


def send_emails_to_subscribed_users(supabase_client) -> Dict:
    """
    Send job notification emails to all users with email_notifications_enabled=true
    Processes users sequentially (queue logic)
    
    DEPRECATED: Use send_email_to_user() instead for per-user scrape workflow
    
    Args:
        supabase_client: Initialized Supabase client
    
    Returns:
        dict with 'success' (bool), 'sent' (int), 'failed' (int), 'details' (list)
    """
    if not supabase_client:
        logger.error("Supabase client not provided")
        return {
            'success': False,
            'sent': 0,
            'failed': 0,
            'details': [],
            'error': 'Database not configured'
        }
    
    try:
        logger.info("=== Starting email notification queue ===")
        
        # 1. Get all users with email notifications enabled
        users_result = supabase_client.table('users') \
            .select('id, email, keywords') \
            .eq('email_notifications_enabled', True) \
            .execute()
        
        users = users_result.data if users_result.data else []
        
        if not users:
            logger.info("No users with email notifications enabled")
            return {
                'success': True,
                'sent': 0,
                'failed': 0,
                'details': [],
                'message': 'No subscribed users found'
            }
        
        logger.info(f"Found {len(users)} users with email notifications enabled")
        
        sent_count = 0
        failed_count = 0
        details = []
        
        # 2. Process each user sequentially (queue logic)
        for i, user in enumerate(users, 1):
            user_id = user.get('id')
            user_email = user.get('email')
            keywords = user.get('keywords', [])
            
            logger.info(f"[{i}/{len(users)}] Processing user: {user_email}")
            
            if not user_email:
                logger.warning(f"User {user_id} has no email address, skipping")
                failed_count += 1
                details.append({
                    'user_id': user_id,
                    'email': None,
                    'status': 'skipped',
                    'reason': 'no email'
                })
                continue
            
            if not keywords or len(keywords) == 0:
                logger.info(f"User {user_email} has no keywords configured, skipping")
                details.append({
                    'user_id': user_id,
                    'email': user_email,
                    'status': 'skipped',
                    'reason': 'no keywords'
                })
                continue
            
            try:
                # 3. Get NEW jobs for this user
                user_jobs_result = supabase_client.table('user_jobs') \
                    .select('''
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
                            site,
                            created_at
                        )
                    ''') \
                    .eq('user_id', user_id) \
                    .eq('status', 'new') \
                    .order('created_at', desc=True) \
                    .execute()
                
                user_jobs = user_jobs_result.data if user_jobs_result.data else []
                
                # 4. Filter jobs by keywords (case-insensitive match in title)
                filtered_jobs = []
                for user_job in user_jobs:
                    job_data = user_job.get('jobs')
                    
                    # Handle both dict and list responses from Supabase
                    if isinstance(job_data, list):
                        job = job_data[0] if job_data else None
                    else:
                        job = job_data
                    
                    if not job or not job.get('title'):
                        continue
                    
                    job_title_lower = job['title'].lower()
                    
                    # Check if any keyword matches the job title
                    if any(keyword.lower() in job_title_lower for keyword in keywords):
                        # Add user_job metadata to job
                        job['user_job_id'] = user_job.get('id')
                        job['status'] = user_job.get('status')
                        job['notes'] = user_job.get('notes')
                        job['user_created_at'] = user_job.get('created_at')
                        job['user_updated_at'] = user_job.get('updated_at')
                        filtered_jobs.append(job)
                
                logger.info(f"User {user_email}: {len(filtered_jobs)} NEW jobs match keywords {keywords}")
                
                # 4b. Sort jobs by date_posted (newest first: Today -> Yesterday -> older dates)
                def get_job_sort_key(job: Dict) -> datetime:
                    """Extract date for sorting, defaulting to epoch if not available"""
                    try:
                        date_posted = job.get('date_posted')
                        if date_posted and str(date_posted) not in ['Not specified', 'null', 'undefined', 'None', '']:
                            date_obj = datetime.fromisoformat(str(date_posted).replace('Z', '+00:00'))
                            if date_obj.tzinfo is None:
                                date_obj = date_obj.replace(tzinfo=timezone.utc)
                            return date_obj
                        
                        # Fallback to created_at
                        created_at = job.get('created_at')
                        if created_at:
                            date_obj = datetime.fromisoformat(str(created_at).replace('Z', '+00:00'))
                            if date_obj.tzinfo is None:
                                date_obj = date_obj.replace(tzinfo=timezone.utc)
                            return date_obj
                    except Exception as e:
                        logger.warning(f"Error parsing date for sorting: {e}")
                    
                    # Default to epoch (oldest possible date)
                    return datetime(1970, 1, 1, tzinfo=timezone.utc)
                
                # Sort in descending order (newest first)
                filtered_jobs.sort(key=get_job_sort_key, reverse=True)
                
                # 5. Send email (even if 0 jobs, so user knows the system is working)
                result = send_job_email(
                    to=user_email,
                    jobs=filtered_jobs,
                    user_name=user_email.split('@')[0]
                )
                
                if result.get('success'):
                    sent_count += 1
                    details.append({
                        'user_id': user_id,
                        'email': user_email,
                        'status': 'sent',
                        'job_count': len(filtered_jobs),
                        'message_id': result.get('message_id')
                    })
                    logger.info(f"✓ Email sent to {user_email} ({len(filtered_jobs)} jobs)")
                else:
                    failed_count += 1
                    details.append({
                        'user_id': user_id,
                        'email': user_email,
                        'status': 'failed',
                        'error': result.get('error')
                    })
                    logger.error(f"✗ Failed to send email to {user_email}: {result.get('error')}")
                
            except Exception as user_error:
                logger.error(f"Error processing user {user_email}: {user_error}")
                failed_count += 1
                details.append({
                    'user_id': user_id,
                    'email': user_email,
                    'status': 'error',
                    'error': str(user_error)
                })
        
        logger.info("=== Email notification queue complete ===")
        logger.info(f"Total: {len(users)} users, {sent_count} sent, {failed_count} failed")
        
        return {
            'success': failed_count == 0,
            'sent': sent_count,
            'failed': failed_count,
            'details': details
        }
        
    except Exception as e:
        logger.error(f"Error in send_emails_to_subscribed_users: {e}")
        return {
            'success': False,
            'sent': 0,
            'failed': 0,
            'details': [],
            'error': str(e)
        }
