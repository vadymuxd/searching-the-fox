# Release 2 Deployment Guide

This guide walks through deploying the changes for Release 2: Backend - Create Search Run Records.

## Prerequisites

- Completed Release 1 (database migration applied)
- Access to Render dashboard for jobspy-service
- Supabase service role key

## Part 1: Update Render Service

### Step 1: Update Dependencies

The Render service needs new Python packages. SSH into your Render service or update via dashboard:

```bash
cd jobspy-service
pip install supabase==2.10.0 python-dotenv==1.0.0
```

Or update `requirements.txt` (already done) and redeploy.

### Step 2: Add Environment Variables to Render

1. Go to your Render dashboard
2. Navigate to your `jobspy-service` web service
3. Go to **Environment** tab
4. Add the following environment variables:

| Key | Value | Notes |
|-----|-------|-------|
| `SUPABASE_URL` | `https://your-project.supabase.co` | Get from Supabase project settings |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | Get from Supabase project settings > API > service_role key |

**Important:** Use the **service_role** key, NOT the anon key. The service role key bypasses RLS and allows the worker to update any user's search runs.

### Step 3: Deploy Updated Code

1. Push the updated code to your repository:
```bash
git add jobspy-service/
git commit -m "Add search run tracking to Render service"
git push
```

2. Render will automatically redeploy (if auto-deploy is enabled)
3. Or manually trigger a deploy from Render dashboard

### Step 4: Verify Deployment

Check the Render logs to confirm:
- ✅ `Supabase client initialized successfully` appears in logs
- ✅ No errors during startup
- ✅ Service is healthy at `/health` endpoint

## Part 2: Test the Integration

### Test 1: Authenticated User Search

1. Log in to your application as a test user
2. Perform a job search (e.g., "Software Engineer" in "London")
3. While search is running, check Supabase:

```sql
SELECT * FROM search_runs ORDER BY created_at DESC LIMIT 1;
```

**Expected:**
- ✅ New row created with status `pending`
- ✅ Status changes to `running` (check Render logs for update)
- ✅ Status changes to `success` with `jobs_found` populated
- ✅ `started_at` and `completed_at` timestamps populated

### Test 2: Guest User Search

1. Log out or use incognito mode
2. Perform a job search
3. Check Supabase:

```sql
SELECT * FROM search_runs ORDER BY created_at DESC LIMIT 1;
```

**Expected:**
- ✅ No new search run created (guest users don't have user_id)
- ✅ Search still works normally (backward compatible)

### Test 3: Search Failure Handling

1. Trigger a search that will fail (e.g., invalid Render URL in environment)
2. Check Supabase:

```sql
SELECT * FROM search_runs WHERE status = 'failed' ORDER BY created_at DESC LIMIT 1;
```

**Expected:**
- ✅ Search run exists with status `failed`
- ✅ `error_message` field populated with error details
- ✅ `completed_at` timestamp populated

### Test 4: Verify Search Run Parameters

```sql
SELECT 
  id,
  source,
  parameters->>'jobTitle' as job_title,
  parameters->>'location' as location,
  parameters->>'site' as site,
  (parameters->>'hours_old')::int as hours_old,
  status,
  jobs_found
FROM search_runs
WHERE user_id = '<your-test-user-id>'
ORDER BY created_at DESC
LIMIT 5;
```

**Expected:**
- ✅ All search parameters correctly stored in JSONB
- ✅ `source` is `manual` for user-initiated searches
- ✅ Data matches what user searched for

## Part 3: Monitor for Issues

### Check Render Logs

```bash
# Look for these log messages:
# ✅ "Supabase client initialized successfully"
# ✅ "Updated search run <id> to status: running"
# ✅ "Updated search run <id> to status: success"
# ❌ "Failed to update search run <id>: ..." (should NOT appear)
```

### Check Supabase Logs

1. Go to Supabase Dashboard > Logs
2. Filter by Table: `search_runs`
3. Look for INSERT and UPDATE operations
4. Verify no permission errors

### Common Issues

#### Issue: "Supabase credentials not found"

**Cause:** Environment variables not set on Render

**Solution:** 
1. Check Render dashboard > Environment
2. Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set
3. Redeploy the service

#### Issue: Search runs not being created

**Cause:** User not logged in OR Next.js not passing userId

**Solution:**
1. Verify user is authenticated
2. Check browser console for errors
3. Verify `JobService.searchJobs()` is being called with userId parameter

#### Issue: "Permission denied" errors in Supabase logs

**Cause:** Using anon key instead of service_role key

**Solution:**
1. Verify you're using `SUPABASE_SERVICE_ROLE_KEY` (not anon key)
2. Service role key should start with `eyJ...` and be very long

#### Issue: Search runs stuck in "running" status

**Cause:** Render service crashed before updating to success/failed

**Solution:**
1. Check Render logs for crashes
2. Manually update stuck runs:
```sql
UPDATE search_runs
SET status = 'failed', error_message = 'Worker crashed', completed_at = NOW()
WHERE status = 'running' AND created_at < NOW() - INTERVAL '10 minutes';
```

## Part 4: Rollback Plan

If anything goes wrong, you can rollback:

### Rollback Render Service

1. Remove environment variables from Render dashboard
2. Revert to previous code version:
```bash
git revert HEAD
git push
```
3. Service will work without search run tracking (backward compatible)

### Data Cleanup

If you need to clean up test data:

```sql
-- Delete test search runs (be careful!)
DELETE FROM search_runs WHERE user_id = '<test-user-id>';
```

## Success Criteria

✅ All tests pass
✅ Authenticated users: search runs created and updated correctly
✅ Guest users: searches work without search runs (backward compatible)
✅ No errors in Render or Supabase logs
✅ Existing search functionality unchanged

## Next Steps

Once Release 2 is verified in production:
- ✅ Monitor for 24 hours
- ✅ Check search run data quality
- 🔜 Proceed to **Release 3**: Frontend - Cross-Device Search Status Visibility
