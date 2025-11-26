# Phase 3 Deployment Checklist

## ✅ Completed Changes

### Code Files
- ✅ Created `jobspy-service/email_service.py` - Email sending module with Resend integration
- ✅ Updated `jobspy-service/requirements.txt` - Added `resend==2.4.0`
- ✅ Updated `jobspy-service/main.py` - Imported email service and triggers after successful scrape
- ✅ Updated `src/lib/email/renderEmailTemplate.ts` - Removed emojis, made title clickable, blue, removed button
- ✅ Created `docs/PHASE_3_EMAIL_AUTOMATION.md` - Complete documentation

### Features Implemented
- ✅ Sequential email queue (one user at a time)
- ✅ Queries users where `email_notifications_enabled = true`
- ✅ Filters NEW jobs by user's keywords
- ✅ Sends personalized HTML email via Resend
- ✅ Logs results: sent count, failed count, details
- ✅ HTML template matches client-side design (no pin, no arrow, clickable blue title, posted time)

## 🚀 Deployment Steps

### 1. Add RESEND_API_KEY to Render

Go to [Render Dashboard](https://dashboard.render.com/)

1. Select service: **truelist-jobspy-api**
2. Click **Environment** tab
3. Click **Add Environment Variable**
4. Add:
   - Key: `RESEND_API_KEY`
   - Value: `re_E1ua17Jp_BgySW9p4Lzv81riR4yvbsUwy`
5. Click **Save Changes**
6. ⏳ Wait for automatic redeploy (1-2 minutes)

### 2. Deploy Code to Render

**If connected to GitHub** (recommended):

```bash
cd "/Users/vadymshcherbakov/Documents/Work/Personal Projects/searching-the-fox"

# Stage all changes
git add .

# Commit
git commit -m "Phase 3: Email automation from Render after job scraping"

# Push (triggers Render auto-deploy)
git push origin main
```

**If manual deploy:**
- Render Dashboard → **Manual Deploy** → **Deploy latest commit**

### 3. Verify Deployment

After deployment completes (~2-3 minutes):

1. **Check Render Logs**:
   - Go to Logs tab
   - Look for: `Supabase client initialized successfully`
   - Look for: No import errors for `email_service`

2. **Check Build Log**:
   - Should show: `Installing resend==2.4.0`
   - Should show: `Starting JobSpy API server on port 8001`

### 4. Test Email Functionality

**Option A: Add test endpoint** (optional, for isolated testing)

Add to `jobspy-service/main.py` before the `if __name__ == "__main__"` block:

```python
@app.post("/test-email-queue")
async def test_email_queue():
    """Test endpoint to manually trigger email queue"""
    if not supabase:
        return {"error": "Database not configured"}
    
    result = send_emails_to_subscribed_users(supabase)
    return result
```

Then redeploy and call:
```bash
curl -X POST https://truelist-jobspy-api.onrender.com/test-email-queue
```

**Option B: Trigger full CRON flow** (recommended for real test)

Prerequisites:
1. Go to https://searching-the-fox.vercel.app/notifications
2. Toggle "Email Notifications" ON
3. Ensure you have keywords configured

Then trigger:
```bash
# Manually trigger CRON job from Vercel
curl -X POST https://searching-the-fox.vercel.app/api/cron/trigger-search
```

Watch Render logs for:
```
[Email Queue] Starting email notifications to subscribed users...
Found 1 users with email notifications enabled
[1/1] Processing user: your@email.com
✓ Email sent to your@email.com (X jobs)
[Email Queue] ✓ Sent 1 emails successfully
```

Check your inbox for email from `onboarding@resend.dev`.

## 🔍 Verification Checklist

After deployment:

- [ ] Render logs show no import errors
- [ ] `RESEND_API_KEY` environment variable is set
- [ ] `resend==2.4.0` installed (check build logs)
- [ ] Email notifications toggle works at `/notifications`
- [ ] Test email sends successfully
- [ ] Email HTML looks correct (blue clickable title, no emojis, no button)
- [ ] Only NEW jobs appear in email
- [ ] Jobs filtered by user's keywords
- [ ] Multiple users each get personalized emails

## 📊 Monitoring After Launch

### Day 1
- [ ] Check Render logs every few hours
- [ ] Verify emails arrive after each CRON run
- [ ] Monitor error rate in logs

### Week 1
- [ ] Count total emails sent (should be 2x users per day, if CRON runs 2x daily)
- [ ] Check for any failed emails
- [ ] Verify no timeout issues in Render (email queue completes <30s)

### Ongoing
- [ ] Weekly: Check Resend dashboard for delivery rate
- [ ] Monthly: Verify staying under Resend free tier limits (3000 emails/month)

## 🐛 Troubleshooting

### No emails sent

**Symptom**: Logs show `Found 0 users with email notifications enabled`

**Fix**:
```sql
-- Check database:
SELECT id, email, email_notifications_enabled, keywords 
FROM users 
WHERE email_notifications_enabled = true;
```

If empty, go to `/notifications` and toggle ON.

---

**Symptom**: Logs show `RESEND_API_KEY is not configured`

**Fix**: Verify environment variable in Render (Step 1 above).

---

**Symptom**: `Error sending email: 403 Forbidden`

**Fix**: 
- Invalid API key → re-check value in Render
- Or sender email not verified → use `onboarding@resend.dev` for testing

### Emails empty (0 jobs)

**Symptom**: Email says "No new jobs found"

**Possible causes**:
1. User has no jobs with `status='new'` → run a job search first
2. Keywords don't match any job titles → broaden keywords or change search terms

**Debug**:
```sql
-- Check user's NEW jobs:
SELECT uj.status, j.title, u.keywords
FROM user_jobs uj
JOIN jobs j ON uj.job_id = j.id
JOIN users u ON uj.user_id = u.id
WHERE uj.user_id = 'your-user-id'
  AND uj.status = 'new';
```

### Email queue times out

**Symptom**: Render logs show HTTP 504 timeout after 30s

**Cause**: Too many users or slow Resend API

**Fixes**:
1. Reduce `results_wanted` per job search (fewer jobs = faster)
2. Add pagination: only send to first 10 users, queue rest for next run
3. Upgrade Render plan (increases timeout to 5min)

## 📈 Success Metrics

### Phase 3 Goals
- ✅ Emails sent automatically after every successful job scrape
- ✅ Each user receives only jobs matching their keywords
- ✅ Sequential processing prevents timeouts and rate limits
- ✅ Comprehensive logging for debugging

### Next Phase Ideas
- [ ] Add "Unsubscribe" link (required for production)
- [ ] Track email opens/clicks via Resend webhooks
- [ ] Add weekly digest option (instead of daily)
- [ ] Support custom frequency (daily, weekly, instant)

## 🔄 Rollback Procedure

If Phase 3 causes issues:

1. **Quick fix** (disable emails only):
   ```python
   # In jobspy-service/main.py, line ~430, comment out:
   # if db_status == "success" and total_jobs > 0:
   #     send_emails_to_subscribed_users(supabase)
   ```

2. **Full rollback** (revert all changes):
   ```bash
   git revert HEAD
   git push origin main
   ```

3. **Emergency** (if Render is down):
   - Disable CRON job in Vercel temporarily
   - Fix Render issues
   - Re-enable CRON

## 📝 Notes

- Render free tier: 750 hours/month, 512MB RAM, 30s HTTP timeout
- Resend free tier: 100 emails/hour, 3000/month
- Current design: Sequential processing (1 user at a time)
- Email template: Matches `/email-template` page exactly
- Database: RLS policies ensure users only see their own jobs

---

**Status**: Ready for deployment ✅

**Estimated time**: 10 minutes (5min env var + 5min deploy)

**Risk level**: Low (emails are non-critical, can be disabled quickly)
