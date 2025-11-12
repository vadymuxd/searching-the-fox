# Release 2 & 3 Combined Testing Guide

This guide provides step-by-step testing instructions for Release 2 (Search Run Tracking) and Release 3 (Browser-Independent Job Saving).

## Overview of Changes

**Release 2:**
- ✅ `search_runs` table tracks all searches
- ✅ Status updates: pending → running → success/failed
- ✅ Render updates search run status via Supabase

**Release 3:**
- ✅ Render saves jobs directly to database for authenticated users
- ✅ Users can close browser mid-search
- ✅ Guest users continue working via localStorage (unchanged)

---

## Prerequisites

- Release 1 migration applied (search_runs table exists)
- Render service deployed with updated code
- Render environment variables set:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Vercel deployment successful

---

## Test Suite

### Test 1: Guest User - No Changes

**Goal:** Verify guest users work exactly as before

**Steps:**
1. Open app in incognito mode (or log out completely)
2. Perform search: "Software Engineer" in "London", LinkedIn
3. Wait for search to complete
4. Verify results appear in UI

**Verify in Browser:**
- ✅ Jobs appear correctly
- ✅ Can filter, sort jobs
- ✅ Check localStorage: `searchData` and `jobs` exist

**Verify in Supabase:**
```sql
-- Should show NO new search_runs (guest has no user_id)
SELECT COUNT(*) FROM search_runs 
WHERE created_at > NOW() - INTERVAL '5 minutes';
-- Expected: 0 (or same count as before)

-- Should show NO new jobs in database
SELECT COUNT(*) FROM jobs 
WHERE created_at > NOW() - INTERVAL '5 minutes';
-- Expected: 0 (guest jobs not saved to DB)
```

**Expected Result:** ✅ Guest user experience unchanged - all data in localStorage

---

### Test 2: Authenticated User - Browser Open (Full Flow)

**Goal:** Verify complete search flow with browser open

**Steps:**
1. Log in as test user
2. Note your user_id from browser console or Supabase
3. Perform search: "Product Designer" in "Manchester", Indeed
4. **Keep browser open** - wait for search to complete (1-3 minutes)
5. Results should appear in UI

**Verify in Supabase - Search Run:**
```sql
-- Check latest search run
SELECT 
  id,
  status,
  jobs_found,
  started_at,
  completed_at,
  created_at,
  parameters
FROM search_runs 
WHERE user_id = '<YOUR_USER_ID>'
ORDER BY created_at DESC 
LIMIT 1;
```

**Expected:**
- ✅ `status` = 'success'
- ✅ `jobs_found` > 0 (should match job count)
- ✅ `started_at` and `completed_at` both populated
- ✅ `parameters` contains your search criteria

**Verify in Supabase - Jobs Saved:**
```sql
-- Check if jobs were saved
SELECT COUNT(*) as new_jobs
FROM jobs 
WHERE created_at > NOW() - INTERVAL '10 minutes';

-- Check if user_jobs relationships created
SELECT COUNT(*) as my_new_jobs
FROM user_jobs 
WHERE user_id = '<YOUR_USER_ID>' 
AND created_at > NOW() - INTERVAL '10 minutes';
```

**Expected:**
- ✅ `new_jobs` > 0 (jobs saved to database)
- ✅ `my_new_jobs` matches `jobs_found` from search_runs

**Verify in UI:**
- ✅ Jobs appear on results page
- ✅ Can see all job details
- ✅ Jobs persist after page refresh

**Expected Result:** ✅ Complete flow works - tracking + database saves

---

### Test 3: Authenticated User - Browser Closed (CRITICAL TEST)

**Goal:** Verify jobs save even when browser is closed

**Steps:**
1. Log in as test user
2. Note the current time
3. Initiate search: "Backend Developer" in "Birmingham", LinkedIn
4. **IMMEDIATELY close the browser tab** (within 5 seconds)
5. Wait 10 minutes
6. Open browser again, navigate to app
7. Log in with same credentials
8. Go to `/results` page

**Verify in Supabase - After 10 Minutes:**
```sql
-- Find the search run from when you closed browser
SELECT 
  id,
  status,
  jobs_found,
  started_at,
  completed_at,
  created_at
FROM search_runs 
WHERE user_id = '<YOUR_USER_ID>'
AND created_at > NOW() - INTERVAL '15 minutes'
ORDER BY created_at DESC;
```

**Expected:**
- ✅ Search run exists
- ✅ `status` = 'success' (even though browser was closed!)
- ✅ `jobs_found` > 0
- ✅ `started_at` and `completed_at` both populated

**Verify Jobs Were Saved:**
```sql
-- Check for jobs from that search
SELECT COUNT(*) as jobs_saved
FROM user_jobs 
WHERE user_id = '<YOUR_USER_ID>'
AND created_at BETWEEN '<search_created_at>' AND '<search_completed_at>';
```

**Expected:**
- ✅ `jobs_saved` > 0 (matches `jobs_found`)

**Verify in UI:**
- ✅ Navigate to `/results`
- ✅ Jobs from the closed-browser search appear
- ✅ Can interact with jobs normally

**Expected Result:** ✅ **KEY FEATURE WORKS** - Jobs saved despite closed browser!

---

### Test 4: Multiple Searches - Authenticated User

**Goal:** Verify multiple searches work and don't interfere

**Steps:**
1. Log in as test user
2. Perform search 1: "Data Scientist" in "London"
3. Wait for completion
4. Perform search 2: "Machine Learning" in "Cambridge"
5. Wait for completion

**Verify in Supabase:**
```sql
-- Should see 2 search runs
SELECT 
  id,
  parameters->>'jobTitle' as search_term,
  status,
  jobs_found,
  created_at
FROM search_runs 
WHERE user_id = '<YOUR_USER_ID>'
ORDER BY created_at DESC 
LIMIT 2;
```

**Expected:**
- ✅ 2 rows with different search terms
- ✅ Both have `status` = 'success'
- ✅ Both have `jobs_found` > 0

**Verify No Duplicates:**
```sql
-- Check for duplicate jobs (same job_url)
SELECT job_url, COUNT(*) as count
FROM jobs
GROUP BY job_url
HAVING COUNT(*) > 1;
```

**Expected:**
- ✅ Returns 0 rows (no duplicates due to UNIQUE constraint)

---

### Test 5: Failed Search Handling

**Goal:** Verify error handling works correctly

**Steps:**
1. Log in as test user
2. Temporarily edit `.env.local` - set invalid Render URL
3. Perform search
4. Observe error in UI
5. Restore correct Render URL

**Verify in Supabase:**
```sql
SELECT 
  id,
  status,
  error_message,
  jobs_found,
  completed_at
FROM search_runs 
WHERE user_id = '<YOUR_USER_ID>'
ORDER BY created_at DESC 
LIMIT 1;
```

**Expected:**
- ✅ `status` = 'failed'
- ✅ `error_message` contains error details
- ✅ `jobs_found` IS NULL
- ✅ `completed_at` is populated

**Verify in UI:**
- ✅ Error notification shown
- ✅ Can retry search
- ✅ No jobs displayed

---

### Test 6: Search Run Status Progression

**Goal:** Verify status changes correctly during search

**Steps:**
1. Log in as test user
2. Open Supabase dashboard (Table Editor for search_runs)
3. Initiate a search
4. **Immediately** query search_runs (within 2 seconds)
5. Refresh a few times during search
6. Check final status

**Queries to run during search:**
```sql
-- Run this immediately after clicking search
SELECT status FROM search_runs 
WHERE user_id = '<YOUR_USER_ID>'
ORDER BY created_at DESC LIMIT 1;
-- Expected: 'pending'

-- Run this 5 seconds later
SELECT status, started_at FROM search_runs 
WHERE user_id = '<YOUR_USER_ID>'
ORDER BY created_at DESC LIMIT 1;
-- Expected: 'running', started_at populated

-- Run after search completes
SELECT status, completed_at, jobs_found FROM search_runs 
WHERE user_id = '<YOUR_USER_ID>'
ORDER BY created_at DESC LIMIT 1;
-- Expected: 'success', completed_at populated, jobs_found > 0
```

**Expected Result:** ✅ Status progresses: pending → running → success

---

### Test 7: Render Logs Verification

**Goal:** Verify Render service is working correctly

**Steps:**
1. Log in to Render dashboard
2. Go to your jobspy-service
3. Click "Logs"
4. Initiate a search from your app
5. Watch logs in real-time

**Look for these log messages:**
```
✅ "Supabase client initialized successfully"
✅ "Starting job scrape request: ..."
✅ "Updated search run <id> to status: running"
✅ "Saving jobs to database for user <user_id>"
✅ "Saved X out of Y jobs to database for user <user_id>"
✅ "Successfully saved X jobs to database"
✅ "Updated search run <id> to status: success"
```

**Should NOT see:**
```
❌ "Failed to update search run"
❌ "Error saving jobs to database" (unless intentional test)
❌ "Supabase credentials not found"
```

---

### Test 8: Data Consistency Check

**Goal:** Verify data integrity across tables

**Run these consistency checks:**

```sql
-- Test 1: All successful searches should have jobs
SELECT COUNT(*) as inconsistent_searches
FROM search_runs 
WHERE status = 'success' 
AND (jobs_found IS NULL OR jobs_found = 0);
-- Expected: 0 (or very small number if genuinely no jobs found)

-- Test 2: All completed searches should have completion timestamp
SELECT COUNT(*) as missing_timestamp
FROM search_runs 
WHERE status IN ('success', 'failed') 
AND completed_at IS NULL;
-- Expected: 0

-- Test 3: All running searches should have started_at
SELECT COUNT(*) as missing_started
FROM search_runs 
WHERE status = 'running' 
AND started_at IS NULL;
-- Expected: 0

-- Test 4: User jobs count should roughly match recent search_runs jobs_found
SELECT 
  sr.jobs_found as search_run_jobs,
  COUNT(uj.id) as actual_user_jobs,
  sr.created_at
FROM search_runs sr
LEFT JOIN user_jobs uj ON (
  uj.user_id = sr.user_id 
  AND uj.created_at BETWEEN sr.created_at AND sr.completed_at
)
WHERE sr.user_id = '<YOUR_USER_ID>'
AND sr.status = 'success'
AND sr.created_at > NOW() - INTERVAL '1 hour'
GROUP BY sr.id, sr.jobs_found, sr.created_at
ORDER BY sr.created_at DESC;
-- Expected: search_run_jobs ~= actual_user_jobs (within a few jobs)
```

---

## Success Criteria Checklist

### Release 2 ✅
- [ ] Search runs created for authenticated users
- [ ] Status progresses: pending → running → success/failed
- [ ] Timestamps populated correctly
- [ ] Error messages captured in failed searches
- [ ] Guest users unaffected (no search runs created)

### Release 3 ✅
- [ ] **Guest users work exactly as before** (localStorage)
- [ ] **Authenticated users can close browser** mid-search
- [ ] **Jobs still save to database** after browser closed
- [ ] Jobs deduplicated correctly (no duplicate job_urls)
- [ ] user_jobs relationships created correctly
- [ ] Render logs show successful database writes
- [ ] UI displays jobs from database correctly
- [ ] No errors in Supabase logs
- [ ] No errors in Render logs
- [ ] All consistency checks pass

---

## Rollback Plan

If critical issues found:

### Quick Rollback (Render)
1. Go to Render dashboard
2. Click "Manual Deploy" → "Deploy Previous Version"
3. System reverts to pre-Release 3 code

### Data Cleanup (if needed)
```sql
-- Remove test data (BE CAREFUL!)
DELETE FROM user_jobs WHERE user_id = '<TEST_USER_ID>';
DELETE FROM search_runs WHERE user_id = '<TEST_USER_ID>';
```

---

## Common Issues & Solutions

### Issue: "Supabase credentials not found" in Render logs
**Solution:** Add environment variables in Render dashboard

### Issue: Jobs not saving to database
**Solution:** 
1. Check Render logs for errors
2. Verify user_id is being passed to Render
3. Check Supabase RLS policies

### Issue: Guest users broken
**Solution:** Verify localStorage logic unchanged in Next.js

### Issue: Search run stuck in "running"
**Solution:** Render crashed - check logs, manually update:
```sql
UPDATE search_runs SET status = 'failed', error_message = 'Worker crashed'
WHERE status = 'running' AND created_at < NOW() - INTERVAL '15 minutes';
```

---

## Next Steps After Testing

Once all tests pass:
1. ✅ Monitor production for 24-48 hours
2. ✅ Check for any user-reported issues
3. ✅ Review Supabase analytics for data quality
4. 🔜 Proceed to **Release 4**: Frontend Cross-Device Status Visibility
