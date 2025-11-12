# Release 2 Testing Checklist

This checklist helps you verify that Release 2 is working correctly before deployment.

## Pre-Deployment Testing (Local)

### ✅ Verify TypeScript Compilation

```bash
cd /Users/vadymshcherbakov/Documents/Work/Personal\ Projects/searching-the-fox
npm run build
```

**Expected:** No TypeScript errors

### ✅ Test searchRunService Functions

Create a test file or use browser console:

```typescript
import { createClient } from '@/lib/supabase/client';
import { createSearchRun, updateSearchRunStatus, getSearchRun } from '@/lib/db/searchRunService';

// Get current user
const supabase = createClient();
const { data: { user } } = await supabase.auth.getUser();

if (user) {
  // Test 1: Create search run
  const searchRun = await createSearchRun({
    userId: user.id,
    parameters: {
      jobTitle: "Test Engineer",
      location: "London",
      site: "indeed",
      hours_old: 24
    },
    source: "manual"
  }, supabase);
  
  console.log('Created search run:', searchRun);
  
  // Test 2: Update to running
  const updated1 = await updateSearchRunStatus({
    runId: searchRun.id,
    status: "running"
  }, supabase);
  
  console.log('Updated to running:', updated1);
  
  // Test 3: Update to success
  const updated2 = await updateSearchRunStatus({
    runId: searchRun.id,
    status: "success",
    jobsFound: 42
  }, supabase);
  
  console.log('Updated to success:', updated2);
  
  // Test 4: Retrieve search run
  const retrieved = await getSearchRun(searchRun.id, supabase);
  console.log('Retrieved search run:', retrieved);
}
```

**Expected:**
- ✅ All operations succeed
- ✅ Timestamps auto-populate correctly
- ✅ `updated_at` changes on each update

---

## Post-Deployment Testing (Production/Staging)

### Test 1: Authenticated User - Successful Search

**Steps:**
1. Log in as a test user
2. Open browser DevTools > Console
3. Perform a search: "Software Engineer" in "London", LinkedIn
4. Note the search run ID from console logs

**Verify in Supabase:**
```sql
SELECT * FROM search_runs ORDER BY created_at DESC LIMIT 1;
```

**Expected Results:**
- ✅ Row created with status initially `pending`
- ✅ Status updates to `running` (visible in real-time if you refresh)
- ✅ Status updates to `success`
- ✅ `jobs_found` populated (should match number of jobs returned)
- ✅ `started_at` timestamp set when status changed to running
- ✅ `completed_at` timestamp set when status changed to success
- ✅ `parameters` JSONB contains correct search criteria
- ✅ `source` is `manual`
- ✅ `user_id` matches your test user
- ✅ Search results appear in UI as normal

**Verify in Render Logs:**
```
# Should see these logs:
Created search run: <run-id>
Updated search run <run-id> to status: running
Updated search run <run-id> to status: success
```

---

### Test 2: Authenticated User - Failed Search

**Steps:**
1. Temporarily break the Render API (change URL to invalid in `.env.local`)
2. Perform a search
3. Observe error in UI

**Verify in Supabase:**
```sql
SELECT * FROM search_runs WHERE status = 'failed' ORDER BY created_at DESC LIMIT 1;
```

**Expected Results:**
- ✅ Row created with status `pending`
- ✅ Status updates to `failed`
- ✅ `error_message` contains error details (e.g., "HTTP error! status: 500")
- ✅ `completed_at` timestamp populated
- ✅ No `jobs_found` value
- ✅ User sees error notification in UI

**Restore:** Change Render URL back to correct value

---

### Test 3: Guest User Search (No userId)

**Steps:**
1. Log out completely
2. Perform a search as guest user

**Verify in Supabase:**
```sql
SELECT COUNT(*) FROM search_runs WHERE created_at > NOW() - INTERVAL '5 minutes';
```

**Expected Results:**
- ✅ No new search run created (count doesn't increase)
- ✅ Search still works normally
- ✅ Jobs appear in localStorage
- ✅ No errors in console
- ✅ Backward compatibility maintained

---

### Test 4: Search "All Job Boards"

**Steps:**
1. Log in as test user
2. Perform search with "All job boards" selected
3. Wait for all sites to complete

**Verify in Supabase:**
```sql
SELECT * FROM search_runs 
WHERE user_id = '<your-user-id>' 
ORDER BY created_at DESC 
LIMIT 5;
```

**Expected Results:**
- ✅ Multiple search runs created (one per job board)
- ✅ All have status `success` (or some failed if sites are down)
- ✅ Each has correct `site` in parameters
- ✅ `jobs_found` totals match UI
- ✅ All complete successfully

---

### Test 5: Verify RLS Policies

**Test as User A:**
```sql
-- As User A, create a search run
-- (via UI)
```

**Test as User B:**
```sql
-- Try to see User A's search runs
SELECT * FROM search_runs WHERE user_id = '<user-a-id>';
```

**Expected Results:**
- ✅ Returns empty (User B cannot see User A's runs)
- ✅ No permission errors (RLS working correctly)

**Test with Service Role:**
```sql
-- Using service_role key in Supabase SQL editor
SELECT * FROM search_runs;
```

**Expected Results:**
- ✅ Returns all search runs (service role bypasses RLS)

---

### Test 6: Real-time Updates (Foundation for Release 3)

**Steps:**
1. Open Supabase Table Editor for `search_runs`
2. In another tab, initiate a search while logged in
3. Watch the Table Editor

**Expected Results:**
- ✅ New row appears immediately with status `pending`
- ✅ Status updates to `running` in real-time
- ✅ Status updates to `success` in real-time
- ✅ Realtime subscriptions work (foundation for Release 3)

---

### Test 7: Search Parameters Storage

**Steps:**
1. Perform searches with various parameters:
   - Different job titles
   - Different locations
   - Different sites (LinkedIn, Indeed)
   - Different hours_old values (24, 72)

**Verify in Supabase:**
```sql
SELECT 
  parameters->>'jobTitle' as job_title,
  parameters->>'location' as location,
  parameters->>'site' as site,
  (parameters->>'hours_old')::int as hours_old,
  parameters->>'country_indeed' as country
FROM search_runs
WHERE user_id = '<your-user-id>'
ORDER BY created_at DESC
LIMIT 10;
```

**Expected Results:**
- ✅ All parameters stored correctly
- ✅ JSONB structure intact
- ✅ Can query by individual parameters
- ✅ No data loss

---

### Test 8: Error Handling - Render Service Down

**Steps:**
1. Stop Render service temporarily (or simulate network issue)
2. Perform a search
3. Observe behavior

**Expected Results:**
- ✅ Search run created with status `pending`
- ✅ Error message shown to user
- ✅ Search run updated to `failed` with error message
- ✅ User can retry search

---

### Test 9: Concurrent Searches

**Steps:**
1. Open 3 browser tabs, all logged in as same user
2. Initiate searches in all 3 tabs simultaneously
3. Monitor results

**Verify in Supabase:**
```sql
SELECT * FROM search_runs 
WHERE user_id = '<your-user-id>' 
AND created_at > NOW() - INTERVAL '5 minutes'
ORDER BY created_at DESC;
```

**Expected Results:**
- ✅ All 3 search runs created
- ✅ All complete successfully (or gracefully fail)
- ✅ No race conditions
- ✅ Each search returns correct results

---

### Test 10: Render Service Logs

**Check Render logs for:**

```
✅ "Supabase client initialized successfully"
✅ "Starting job scrape request: ..."
✅ "Updated search run <id> to status: running"
✅ "Updated search run <id> to status: success"
✅ "Successfully processed X jobs"
❌ No "Failed to update search run" errors
❌ No authentication/permission errors
```

---

## Integration Tests

### Test Data Consistency

```sql
-- All completed searches should have timestamps
SELECT COUNT(*) FROM search_runs 
WHERE status IN ('success', 'failed') 
AND completed_at IS NULL;
-- Expected: 0

-- All running searches should have started_at
SELECT COUNT(*) FROM search_runs 
WHERE status = 'running' 
AND started_at IS NULL;
-- Expected: 0

-- Success searches should have jobs_found
SELECT COUNT(*) FROM search_runs 
WHERE status = 'success' 
AND jobs_found IS NULL;
-- Expected: 0 (or small number if no jobs were found)

-- Failed searches should have error_message
SELECT COUNT(*) FROM search_runs 
WHERE status = 'failed' 
AND error_message IS NULL;
-- Expected: 0
```

### Test Performance

**Measure search time with tracking:**
1. Note current search time without tracking
2. Perform 10 searches with tracking enabled
3. Calculate average time

**Expected Results:**
- ✅ Overhead < 100ms per search
- ✅ No noticeable UI lag
- ✅ Database writes don't block user experience

---

## Final Verification Checklist

Before marking Release 2 as complete:

- [ ] ✅ All TypeScript compiles without errors
- [ ] ✅ searchRunService functions work correctly
- [ ] ✅ Authenticated user searches create and update search runs
- [ ] ✅ Guest user searches work without creating search runs
- [ ] ✅ Failed searches update status to 'failed' with error message
- [ ] ✅ RLS policies enforce user isolation
- [ ] ✅ Service role can access all search runs
- [ ] ✅ Search parameters stored correctly in JSONB
- [ ] ✅ Timestamps auto-populate correctly
- [ ] ✅ Render service logs show successful updates
- [ ] ✅ No errors in Supabase logs
- [ ] ✅ Existing search functionality unchanged
- [ ] ✅ Performance acceptable (< 100ms overhead)
- [ ] ✅ Real-time updates work (foundation for Release 3)

---

## Known Issues / Edge Cases

Document any issues found during testing:

1. **Issue:** _________________
   **Impact:** _________________
   **Workaround:** _________________

2. **Issue:** _________________
   **Impact:** _________________
   **Workaround:** _________________

---

## Sign-off

**Tested by:** _________________
**Date:** _________________
**Environment:** Production / Staging / Local
**Status:** ✅ Pass / ❌ Fail

**Notes:**
_________________
_________________
_________________

---

## Next Steps

Once all tests pass:
1. ✅ Monitor production for 24 hours
2. ✅ Review Supabase analytics for search run data
3. 🔜 Proceed to **Release 3**: Frontend - Cross-Device Search Status Visibility
