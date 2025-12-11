# Phase 3: Email Automation from Render

## Overview

After CRON jobs from Vercel trigger job scraping on Render, the Python service will automatically send email notifications to all subscribed users with their personalized NEW jobs filtered by keywords.

## Architecture Flow

```
1. Vercel CRON (9-10am, 3-4pm daily)
   ↓
2. Triggers /worker/poll-queue on Render
   ↓
3. Render processes pending search_runs (one user at a time)
   ↓
4. For each user: scrapes jobs from LinkedIn, Indeed, etc.
   ↓
5. Saves jobs to database with status='new'
   ↓
6. Updates search_runs.status = 'success'
   ↓
7. **NEW: Email Queue Triggered**
   ↓
8. Queries all users with email_notifications_enabled=true
   ↓
9. For each subscribed user (sequential processing):
   - Fetches their NEW jobs
   - Filters by their keywords
   - Sends personalized email via Resend
   ↓
10. Logs results: X sent, Y failed
```

## Files Changed

### New Files

1. **`jobspy-service/email_service.py`** - Python email module
   - `send_job_email(to, jobs, user_name)` - Send email via Resend
   - `render_email_template(jobs, user_email)` - Generate HTML (mirrors TypeScript version)
   - `send_emails_to_subscribed_users(supabase_client)` - Queue processor

### Modified Files

1. **`jobspy-service/requirements.txt`**
   - Added: `resend==2.4.0`

2. **`jobspy-service/main.py`**
   - Imported `send_emails_to_subscribed_users` from `email_service`
   - Updated `log_final_status()` function:
     - After `search_runs.status = 'success'` and `total_jobs > 0`
     - Calls `send_emails_to_subscribed_users(supabase)`
     - Logs email queue results

## Setup Instructions

### Step 1: Add RESEND_API_KEY to Render

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Select your service: **truelist-jobspy-api** (or whatever name you used)
3. Click **Environment** tab
4. Click **Add Environment Variable**
5. Add:
   - **Key**: `RESEND_API_KEY`
   - **Value**: `re_E1ua17Jp_BgySW9p4Lzv81riR4yvbsUwy` (your Resend API key)
6. Click **Save Changes**
7. Render will automatically redeploy with the new environment variable

### Step 2: Deploy Updated Code to Render

**Option A: Git Push (Recommended)**

If your Render service is connected to GitHub:

```bash
cd "/Users/vadymshcherbakov/Documents/Work/Personal Projects/searching-the-fox"

# Stage changes
git add jobspy-service/email_service.py
git add jobspy-service/requirements.txt
git add jobspy-service/main.py
git add docs/PHASE_3_EMAIL_AUTOMATION.md

# Commit
git commit -m "Phase 3: Add email automation after job scraping"

# Push to trigger Render deployment
git push origin main
```

Render will automatically:
- Pull the latest code
- Install `resend==2.4.0` from requirements.txt
- Restart the service

**Option B: Manual Deploy**

If not connected to Git:
1. Go to Render Dashboard → your service
2. Click **Manual Deploy** → **Deploy latest commit**

### Step 3: Verify Environment Variables

After deployment, check logs in Render:

1. Go to **Logs** tab
2. Look for startup message: `Supabase client initialized successfully`
3. Trigger a test scrape (see Testing section below)
4. Look for: `[Email Queue] Starting email notifications to subscribed users...`

## How It Works

### Queue Logic (Sequential Processing)

The email queue processes users **one by one** to avoid:
- Memory issues (Render free tier has 512MB RAM limit)
- Rate limiting from Resend
- Timeout issues

```python
# Pseudocode from email_service.py
for user in subscribed_users:
    jobs = get_new_jobs_for_user(user.id, status='new')
    filtered_jobs = filter_by_keywords(jobs, user.keywords)
    send_email(user.email, filtered_jobs)
    log_result()
```

### Email Content

Each user receives:
- **Subject**: "X New Jobs Matching Your Criteria" (or "No New Jobs This Time")
- **Body**: HTML template with:
  - Only jobs with status='new'
  - Only jobs matching their keywords (case-insensitive)
  - Company logo, location, job title (clickable), posted time
  - Remote badge, salary (if available)

### Database Schema

**Required columns:**
- `users.email_notifications_enabled` (BOOLEAN, default FALSE)
- `users.keywords` (TEXT[], array of job title keywords)
- `user_jobs.status` (ENUM: new, interested, applied, ...)

**Filtering logic:**
```python
# Only send jobs where:
# 1. user_jobs.status = 'new'
# 2. jobs.title contains ANY of user.keywords (case-insensitive)

keywords = ['frontend', 'react', 'javascript']
job_title = 'Senior Frontend Developer'
# Match: 'frontend' in 'Senior Frontend Developer'.lower() ✓
```

## Testing the Flow

### Test 1: Manual Email Queue Trigger (without scraping)

This tests email sending independently:

```bash
# In Render logs or local terminal:
curl -X POST https://truelist-jobspy-api.onrender.com/test-email-queue
```

Expected response:
```json
{
  "success": true,
  "sent": 2,
  "failed": 0,
  "details": [
    {
      "user_id": "uuid-123",
      "email": "user@example.com",
      "status": "sent",
      "job_count": 5,
      "message_id": "resend-msg-id"
    }
  ]
}
```

**Note:** You need to add this test endpoint to `main.py` (optional):

```python
@app.post("/test-email-queue")
async def test_email_queue():
    """Test endpoint to manually trigger email queue"""
    if not supabase:
        return {"error": "Database not configured"}
    
    result = send_emails_to_subscribed_users(supabase)
    return result
```

### Test 2: End-to-End CRON Flow

1. **Enable email notifications** for your test user:
   - Go to https://search-the-fox.com/notifications
   - Toggle "Email Notifications" ON
   - Ensure you have keywords set up in your profile

2. **Trigger CRON manually**:
   ```bash
   # From your local machine:
   curl -X POST https://search-the-fox.com/api/cron/trigger-search
   ```

3. **Watch Render logs**:
   - Go to Render Dashboard → Logs
   - You should see:
     ```
     [INGRESS] method=POST path=/worker/poll-queue
     Starting job scrape request...
     [linkedin] Scraping jobs...
     [linkedin] ✓ Completed. Total jobs so far: 15
     [Database] Finalizing search_run abc-123 with status: success
     [Email Queue] Starting email notifications to subscribed users...
     Found 1 users with email notifications enabled
     [1/1] Processing user: your@email.com
     User your@email.com: 5 NEW jobs match keywords ['frontend', 'react']
     ✓ Email sent to your@email.com (5 jobs)
     [Email Queue] ✓ Sent 1 emails successfully
     ```

4. **Check your inbox**:
   - From: `onboarding@resend.dev`
   - Subject: "5 New Jobs Matching Your Criteria"
   - Body: HTML template with 5 job cards

### Test 3: Multiple Users

1. Create 2-3 test users with different keywords
2. Enable email notifications for all
3. Trigger CRON
4. Each user should receive personalized emails with jobs matching **their** keywords

**Example:**
- User A (keywords: `['frontend', 'react']`) → gets 5 jobs
- User B (keywords: `['backend', 'python']`) → gets 3 jobs
- User C (keywords: `['data science']`) → gets 0 jobs (but still gets email saying "No New Jobs This Time")

## Troubleshooting

### Issue: No emails sent

**Check:**
1. Render logs: `[Email Queue] Found 0 users with email notifications enabled`
   - **Fix**: Enable notifications in `/notifications` page
   
2. Render logs: `RESEND_API_KEY is not configured`
   - **Fix**: Add env var in Render (Step 1 above)

3. Render logs: `Error sending email: 403 Forbidden`
   - **Fix**: Invalid Resend API key or sender email not verified
   - For testing, use `onboarding@resend.dev` (always works)
   - For production, verify your domain in Resend dashboard

### Issue: Emails sent but empty (0 jobs)

**Check:**
1. User has no jobs with status='new'
   - **Fix**: Run a job search, jobs should have `user_jobs.status = 'new'` initially

2. User keywords don't match any job titles
   - **Example**: Keywords `['ceo']` but all jobs are `'Software Engineer'`
   - **Fix**: Add broader keywords or scrape different job titles

### Issue: Some emails fail

**Check Render logs:**
```
[Email Queue] Completed with 5 sent, 2 failed
[Email Queue] ✗ Failed to send email to bad@email.com: Invalid email address
```

Common errors:
- Invalid email format
- Resend rate limit (100 emails/hour on free tier)
- SMTP error from Resend

## Scaling Considerations

### Current Design (Phase 3)

- **Sequential processing**: One user at a time
- **Trigger**: After each successful scrape (could be multiple times per day)
- **Limitations**: 
  - Render free tier: 30s HTTP timeout (email queue must complete in <30s)
  - Resend free tier: 100 emails/hour, 3000/month

### Future Optimizations (if needed)

1. **Background job queue** (Celery + Redis)
   - Move email sending to async worker
   - Avoids HTTP timeout issues

2. **Batch sending** (Resend Batch API)
   - Send up to 100 emails in one API call
   - Faster for many users

3. **Rate limiting**
   - Track emails sent per hour
   - Queue excess emails for next hour

4. **Database flag** (prevent duplicate emails)
   - Add `last_email_sent_at` to users table
   - Only send if >24 hours since last email

## Security Notes

1. **RESEND_API_KEY** is server-side only (never exposed to client)
2. Email HTML is sanitized (no user-generated content injected)
3. Job data comes from trusted database (Supabase RLS policies apply)
4. Sender email: `onboarding@resend.dev` (Resend verified domain)

## Monitoring

### Key Metrics to Watch

1. **Email success rate**
   - Render logs: `[Email Queue] ✓ Sent X emails successfully`
   - Target: >95% success

2. **Queue processing time**
   - Render logs: Time between "Starting email notifications" and "Email notification queue complete"
   - Target: <30s (to avoid HTTP timeout)

3. **User engagement**
   - Track opens/clicks via Resend dashboard (requires Resend webhook setup)

4. **Job match rate**
   - How many users get 0 jobs vs >0 jobs
   - If most users get 0 jobs, keywords might be too specific

## Next Steps

Once Phase 3 is live and tested:

1. **Monitor for 1 week** - Check logs daily, verify emails arrive
2. **Gather feedback** - Ask users if emails are helpful
3. **Optimize keywords** - If too many/too few emails, adjust keyword matching logic
4. **Add unsubscribe link** - Required for production email compliance
5. **Verify domain** - Move from `onboarding@resend.dev` to `noreply@search-the-fox.com` (or `noreply@mail.search-the-fox.com`)

## Rollback Plan

If emails cause issues:

```python
# In main.py, comment out this section in log_final_status():

# # Trigger email notifications after successful scraping
# if db_status == "success" and total_jobs > 0:
#     logger.info("[Email Queue] Starting email notifications to subscribed users...")
#     ...
```

Git revert:
```bash
git revert HEAD
git push origin main
```

Render will redeploy without email automation.
