# Troubleshooting: Jobs Not Saving After Search

## Symptoms

- Search completes successfully (API responds)
- Loading indicator shows for a few minutes
- Redirects to `/results` page
- No new jobs appear in the UI
- Database shows no new jobs added

## Debugging Steps

### 1. Check Browser Console Logs

After performing a search, check the browser console for these logs:

```
Expected log sequence:
[Search] API returned X jobs
[Search] Saving X jobs for authenticated user
[saveNewJobsAndSync] Saving X jobs to database for user {userId}
[saveJobsToDatabase] Starting to save X jobs for user {userId}
[saveJobsToDatabase] Found X existing jobs in database
[saveJobsToDatabase] X new jobs to insert, X already exist
[saveJobsToDatabase] Inserting batch 1/Y (X jobs)
[saveJobsToDatabase] Total job IDs to process: X
[saveJobsToDatabase] X new user_jobs entries to create, X already exist
[saveJobsToDatabase] Inserting user_jobs batch 1/Y (X entries)
[saveJobsToDatabase] Successfully saved X jobs total
[saveNewJobsAndSync] Successfully saved X jobs to database
[saveNewJobsAndSync] Syncing to fetch prioritized jobs for display
[saveNewJobsAndSync] Sync complete, fetched X jobs for cache
[Search] Successfully saved X jobs to database
```

### 2. Common Issues & Solutions

#### Issue 1: API Returns 0 Jobs

**Symptoms:**
```
[Search] API returned 0 jobs
```

**Causes:**
- Search criteria too restrictive
- No jobs match the filters (location, job title, posted within)
- Job board API is down or rate-limited

**Solution:**
- Try broader search terms
- Increase "Posted within" timeframe
- Try different job board
- Check if the Python API is running correctly

#### Issue 2: Empty Jobs Array But Success=True

**Symptoms:**
```
[Search] API returned 0 jobs
```
But no error is shown

**Cause:**
- Python API returned `{ success: true, jobs: [] }`

**Solution:**
- This is now handled - user will see "No jobs found" notification
- No database operations are performed

#### Issue 3: Database Save Fails with "Bad Request"

**Symptoms:**
```
[saveJobsToDatabase] Starting to save 1002 jobs...
[saveNewJobsAndSync] Failed to save jobs: Bad Request
```

**Causes:**
- **Request size too large**: Supabase has limits on query complexity
- **Too many items in .in() query**: Arrays with 500+ items can fail
- **Batch size too large**: Large insert operations can timeout

**Solutions:**

1. **Reduced batch size** (Fixed in latest version):
   - Changed from 500 to 100 items per batch
   - Reduces load on Supabase API
   - Prevents "Bad Request" errors

2. **If you see this error**:
   - Update to latest code (batch size now 100)
   - Should see logs like: `Checking 1002 URLs in 11 batches`
   - Each batch processes separately

3. **Verify the fix worked**:
   ```
   [saveJobsToDatabase] Checking 1002 URLs in 11 batches
   [saveJobsToDatabase] Checking batch 1/11 (100 URLs)
   [saveJobsToDatabase] Checking batch 2/11 (100 URLs)
   ...
   [saveJobsToDatabase] ✅ Successfully saved 1002 jobs total
   ```

#### Issue 4: Database Save Fails

**Symptoms:**
```
[saveJobsToDatabase] Starting to save X jobs...
Error: [some database error]
Search failed: Failed to save jobs to database
```

**Causes:**
- Supabase connection issue
- Authentication expired
- Database permissions problem
- Malformed job data

**Solutions:**
1. Check Supabase connection:
   - Go to Supabase dashboard
   - Verify project is running
   - Check API keys are correct

2. Re-authenticate:
   - Sign out and sign back in
   - Clear browser cache

3. Check job data:
   - Look for jobs with missing required fields
   - Check console for data validation errors

#### Issue 4: All Jobs Already Exist

**Symptoms:**
```
[saveJobsToDatabase] Found 50 existing jobs in database
[saveJobsToDatabase] 0 new jobs to insert, 50 already exist
[saveJobsToDatabase] 0 new user_jobs entries to create, 50 already exist
[saveJobsToDatabase] Successfully saved 50 jobs total
```

**Explanation:**
- This is NORMAL if you're searching for the same jobs again
- All 50 jobs were already in your account
- The `jobsSaved: 50` means "50 jobs are associated with your account"

**Not a bug if:**
- You're re-running the same search
- Jobs from this search were already saved previously

**Possible bug if:**
- You changed search criteria significantly
- You expect new jobs but none appear

**Solution:**
- Try completely different search terms
- Check a different job board
- Increase "Posted within" to get more results

#### Issue 5: Supabase Client Not Initialized

**Symptoms:**
```
Error: Cannot read properties of undefined
```

**Cause:**
- Server-side Supabase client creation failed

**Solution:**
1. Check environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

2. Restart development server
3. Clear `.next` cache: `rm -rf .next`

### 3. Manual Database Check

Connect to Supabase and run these queries:

```sql
-- Check total jobs for user
SELECT COUNT(*) 
FROM user_jobs 
WHERE user_id = 'your-user-id';

-- Check recent jobs
SELECT uj.status, j.title, j.company, uj.created_at
FROM user_jobs uj
JOIN jobs j ON uj.job_id = j.id
WHERE uj.user_id = 'your-user-id'
ORDER BY uj.created_at DESC
LIMIT 10;

-- Check jobs added in last hour
SELECT COUNT(*) 
FROM user_jobs 
WHERE user_id = 'your-user-id' 
AND created_at > NOW() - INTERVAL '1 hour';
```

### 4. Check Python API

Test the Python API directly:

```bash
curl -X POST http://localhost:8000/scrape \
  -H "Content-Type: application/json" \
  -d '{
    "search_term": "product manager",
    "location": "London",
    "site_name": ["indeed"],
    "results_wanted": 10,
    "hours_old": 168
  }'
```

Expected response:
```json
{
  "success": true,
  "jobs": [...],
  "total_results": 10
}
```

### 5. Network Tab Analysis

1. Open DevTools → Network tab
2. Perform search
3. Look for `/scrape` request
4. Check response:
   - Status: Should be 200
   - Response body: Should contain `jobs` array
   - Response size: Should not be empty

## Recent Fixes Applied

### Fix 1: Reduced Batch Size (Nov 5, 2025 - Latest)

**Problem:** "Bad Request" error when saving 1000+ jobs
- Batch size of 500 was too large for Supabase
- `.in()` queries with 500+ items failing
- Request payload too large

**Solution:**
```typescript
// Before:
const BATCH_SIZE = 500; // Too large!

// After:
const BATCH_SIZE = 100; // Safe for Supabase
```

**Impact:**
- Can now save 1000+ jobs without errors
- More granular progress tracking (11 batches instead of 2-3)
- Better error isolation (if one batch fails, only 100 jobs affected)

### Fix 2: Enhanced Error Messages

**Problem:** Generic "Bad Request" error, hard to debug

**Solution:** Added specific error messages:
```typescript
error: `Failed to check existing jobs: ${error.message}`
error: `Failed to insert jobs (batch ${i + 1}): ${error.message}`
error: `Failed to create user_jobs (batch ${i + 1}): ${error.message}`
```

### Fix 3: Detailed Batch Logging

**Added comprehensive logging:**
```
[saveJobsToDatabase] Checking 1002 URLs in 11 batches
[saveJobsToDatabase] Checking batch 1/11 (100 URLs)
[saveJobsToDatabase] Inserting 950 new jobs in 10 batches
[saveJobsToDatabase] Inserting batch 1/10 (100 jobs)
[saveJobsToDatabase] Batch 1 inserted successfully, got 100 IDs
[saveJobsToDatabase] Creating user_jobs entries in 10 batches
[saveJobsToDatabase] User_jobs batch 1 inserted successfully
[saveJobsToDatabase] ✅ Successfully saved 1002 jobs total
```

### Fix 4: Added Error Checking (Earlier fix)

**Problem:** `saveNewJobsAndSync` could fail silently

**Problem:** `saveNewJobsAndSync` could fail silently
- Function returned `{ success: false, error: '...' }`
- Calling code didn't check the return value
- Page redirected even if save failed

**Solution:**
```typescript
const saveResult = await jobsDataManager.saveNewJobsAndSync(...);
if (!saveResult.success) {
  throw new Error(saveResult.error || 'Failed to save jobs');
}
```

### Fix 5: Empty Jobs Array Handling

**Problem:** API could return 0 jobs with success=true
- User sees loading, then empty results
- No feedback about what happened

**Solution:**
```typescript
if (!response.jobs || response.jobs.length === 0) {
  notifications.show({
    title: 'No jobs found',
    message: 'Try adjusting your search parameters.',
    color: 'yellow',
  });
  return;
}
```

### Fix 6: Enhanced Logging

**Problem:** Hard to debug what's happening

**Solution:** Added comprehensive logging at every step (see Fix 3 above)

### Fix 7: Batch Processing for Large Saves

**Problem:** Large job searches could hit query limits

**Solution:** Process in batches (now 100 per batch, was 500)
- Handles 1000+ jobs safely
- Continues on partial failures
- Logs progress for each batch

## Prevention

### Best Practices

1. **Always check console logs** after a search
2. **Look for success notification** - should see "Found and saved X jobs"
3. **Verify job count** in the UI matches the notification
4. **If no jobs found**, try different search criteria
5. **Report issues** with full console logs

### When to Report a Bug

Report if you see:
- ❌ Error messages in console
- ❌ Jobs returned by API but not saved
- ❌ Database errors
- ❌ Timeout errors
- ❌ Unexpected behavior not covered in this guide

Don't report if:
- ✅ "No jobs found" notification (just try different search)
- ✅ All jobs already exist (normal for repeat searches)
- ✅ Zero new jobs when re-running same search

## Contact

If issues persist after following these steps, provide:
1. Full console logs
2. Search parameters used
3. Expected vs actual results
4. Network tab screenshot
5. Database query results (if accessible)
