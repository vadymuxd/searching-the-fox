# Testing Plan: Backend Orchestration Architecture

## Overview
This document outlines the testing strategy for the refactored backend orchestration architecture where the Python API processes all job boards in a single request.

## Test Environment Setup

### Prerequisites
- ✅ Python API running on Render.com
- ✅ Next.js frontend running locally or on Vercel
- ✅ Supabase database with `search_runs` table
- ✅ User authenticated (for database writes)

### Configuration
- API Endpoint: `/api/proxy-scrape`
- Database polling interval: 3 seconds
- Real-time subscriptions: Enabled

## Test Cases

### 1. Single Job Board Search - LinkedIn

**Objective**: Verify single-site search works with new architecture

**Steps**:
1. Navigate to homepage
2. Enter job title: "Software Engineer"
3. Enter location: "London"
4. Select job board: "LinkedIn"
5. Click "Search"

**Expected Results**:
- ✅ Search run created in database with status "running"
- ✅ SearchRunning component appears in top-right
- ✅ Timer starts counting
- ✅ Python API receives request with `site_name: ['linkedin']`
- ✅ Jobs saved to database progressively
- ✅ Search run status updated to "success" after completion
- ✅ SearchRunning component disappears
- ✅ Page auto-refreshes showing results
- ✅ Results page shows LinkedIn jobs

**Database Verification**:
```sql
SELECT id, status, jobs_found, created_at, updated_at 
FROM search_runs 
WHERE user_id = '<user_id>' 
ORDER BY created_at DESC 
LIMIT 1;
```

**Log Verification** (Python API):
```
[linkedin] Starting scrape (1/1)...
[linkedin] Found X jobs
[linkedin] Successfully saved Y/X jobs to database
[linkedin] ✓ Completed. Total jobs so far: Y

================================================================================
JOB SCRAPING SUMMARY
================================================================================
  ✓ linkedin: completed: Y jobs
--------------------------------------------------------------------------------
Overall Status: SUCCESS
Job Boards: 1 completed, 0 failed, 0 pending
Total Jobs Found: Y
Increment Only Mode: No (Final Update)
================================================================================
```

---

### 2. Single Job Board Search - Indeed

**Objective**: Verify Indeed-specific configuration works

**Steps**:
1. Enter job title: "Data Analyst"
2. Enter location: "Manchester"
3. Select job board: "Indeed"
4. Click "Search"

**Expected Results**:
- Same as Test 1, but for Indeed
- ✅ `country_indeed: 'UK'` passed to API
- ✅ Results page shows Indeed jobs

---

### 3. Multi-Site Search - All Job Boards

**Objective**: Verify backend processes all sites in single request

**Steps**:
1. Enter job title: "Product Manager"
2. Enter location: "Birmingham"
3. Select job board: "All job boards"
4. Click "Search"

**Expected Results**:
- ✅ Single search run created in database
- ✅ Single API call made with `site_name: ['linkedin', 'indeed']`
- ✅ SearchRunning component shows "Searching all job boards..."
- ✅ Python API processes LinkedIn first
- ✅ Database `jobs_found` incremented after LinkedIn completes
- ✅ Python API processes Indeed second
- ✅ Database `jobs_found` incremented after Indeed completes
- ✅ Search run status updated to "success" at end
- ✅ Page shows jobs from both sources with proper `source_site` labels

**Database Verification**:
```sql
-- Should see progressive updates to jobs_found
SELECT id, status, jobs_found, updated_at 
FROM search_runs 
WHERE user_id = '<user_id>' 
ORDER BY created_at DESC 
LIMIT 1;

-- Check jobs from both sources
SELECT source_site, COUNT(*) 
FROM jobs 
WHERE search_run_id = '<run_id>' 
GROUP BY source_site;
```

**Log Verification**:
```
Starting job scrape request: {...}
Job boards requested: linkedin, indeed

[Site 1/2] Processing linkedin...
[linkedin] Found X jobs
[linkedin] Successfully saved Y jobs to database
[linkedin] ✓ Completed. Total jobs so far: Y

[Site 2/2] Processing indeed...
[indeed] Found A jobs
[indeed] Successfully saved B jobs to database
[indeed] ✓ Completed. Total jobs so far: Y+B

================================================================================
JOB SCRAPING SUMMARY
================================================================================
  ✓ linkedin: completed: Y jobs
  ✓ indeed: completed: B jobs
--------------------------------------------------------------------------------
Overall Status: SUCCESS
Job Boards: 2 completed, 0 failed, 0 pending
Total Jobs Found: Y+B
Increment Only Mode: No (Final Update)
================================================================================
```

---

### 4. Multi-Site Search with One Site Failing

**Objective**: Verify one site failure doesn't prevent other sites from processing

**Setup**: Temporarily break one job board (e.g., invalid location for Indeed)

**Steps**:
1. Enter job title: "DevOps Engineer"
2. Enter location: "InvalidLocation123"
3. Select: "All job boards"
4. Click "Search"

**Expected Results**:
- ✅ LinkedIn processes successfully
- ✅ Indeed fails but doesn't crash entire search
- ✅ Search run status: "success" or "partial_success" (based on log_final_status logic)
- ✅ Jobs from successful site saved
- ✅ SearchRunning component shows completion

**Log Verification**:
```
[linkedin] ✓ Completed. Total jobs so far: Y
[indeed] Failed: <error message>

================================================================================
JOB SCRAPING SUMMARY
================================================================================
  ✓ linkedin: completed: Y jobs
  ✗ indeed: failed: <error>
--------------------------------------------------------------------------------
Overall Status: PARTIAL SUCCESS
Job Boards: 1 completed, 1 failed, 0 pending
Total Jobs Found: Y
================================================================================
```

---

### 5. User Closes Browser Mid-Search

**Objective**: Verify search completes even if user closes browser

**Steps**:
1. Start multi-site search ("All job boards")
2. Observe SearchRunning component appear
3. **Immediately close browser tab/window**
4. Wait 30-60 seconds
5. Re-open application and navigate to results page

**Expected Results**:
- ✅ Python API continues processing after browser closed
- ✅ All job boards processed
- ✅ Jobs saved to database
- ✅ Search run status updated to "success"
- ✅ When user re-opens app, results are visible
- ✅ No "stuck on running" status

**Verification**:
```sql
-- Check that search completed
SELECT id, status, jobs_found, 
       created_at, updated_at,
       updated_at - created_at as duration
FROM search_runs 
WHERE user_id = '<user_id>' 
ORDER BY created_at DESC 
LIMIT 1;

-- Status should be "success", not "running"
-- jobs_found should have accumulated from both sites
```

---

### 6. Zero Jobs Found Scenario

**Objective**: Verify graceful handling when no jobs match criteria

**Steps**:
1. Enter job title: "UnicornEngineer2025XYZ"
2. Enter location: "London"
3. Select: "All job boards"
4. Click "Search"

**Expected Results**:
- ✅ Search completes without errors
- ✅ Search run status: "success"
- ✅ `jobs_found: 0`
- ✅ UI shows "No jobs found" message
- ✅ No database errors

**Log Verification**:
```
[linkedin] No jobs found
[indeed] No jobs found

================================================================================
Overall Status: SUCCESS
Job Boards: 2 completed, 0 failed, 0 pending
Total Jobs Found: 0
================================================================================
```

---

### 7. All Sites Fail Scenario

**Objective**: Verify error handling when all job boards fail

**Setup**: Use invalid credentials or break all job board connections

**Expected Results**:
- ✅ Search run status: "failed"
- ✅ Error message logged
- ✅ SearchRunning component shows failure
- ✅ No partial results saved

**Log Verification**:
```
================================================================================
Overall Status: FAILED
Job Boards: 0 completed, 2 failed, 0 pending
Total Jobs Found: 0
================================================================================
```

---

### 8. Database Status Polling

**Objective**: Verify frontend correctly polls database for status

**Steps**:
1. Start search
2. Open browser DevTools → Network tab
3. Observe database polling behavior

**Expected Results**:
- ✅ Polling occurs every 3 seconds
- ✅ Real-time subscriptions active
- ✅ SearchRunning component updates in real-time
- ✅ Timer continues counting during search
- ✅ Component disappears when status changes to "success"/"failed"

---

### 9. Page Refresh During Search

**Objective**: Verify SearchRunning component persists across page refreshes

**Steps**:
1. Start multi-site search
2. Wait 5 seconds
3. Refresh page (F5 or Cmd+R)

**Expected Results**:
- ✅ SearchRunning component reappears after refresh
- ✅ Timer shows correct elapsed time
- ✅ Search continues on backend
- ✅ Database polling resumes

---

### 10. Concurrent Searches Prevention

**Objective**: Verify user cannot start multiple searches simultaneously

**Steps**:
1. Start search for "Engineer"
2. Immediately try to start another search for "Developer"

**Expected Results**:
- ✅ Second search blocked or queued
- ✅ UI shows "Search already in progress"
- ✅ Only one active search run in database at a time

---

## Performance Tests

### P1. Large Result Set (1000+ jobs)

**Steps**:
1. Search for common term: "Manager"
2. Location: "London"
3. All job boards
4. `results_wanted: 1000`

**Expected**:
- ✅ Completes within 2 minutes
- ✅ No timeout errors
- ✅ All jobs saved to database
- ✅ UI responsive

### P2. Multiple Rapid Searches

**Steps**:
1. Complete search 1
2. Immediately start search 2
3. Immediately start search 3

**Expected**:
- ✅ Each search completes successfully
- ✅ No database conflicts
- ✅ Search runs created in correct order

---

## Regression Tests

### R1. Logo Fetching Still Works
- ✅ Company logos fetched for jobs
- ✅ Fallback logos used when primary fails

### R2. Job Deduplication
- ✅ Duplicate jobs (same title + company) removed
- ✅ Priority order: LinkedIn > Indeed

### R3. Authentication Flow
- ✅ Guest users can search (no database writes)
- ✅ Authenticated users get search runs saved
- ✅ Jobs properly associated with user

### R4. Email Confirmation
- ✅ Unverified users see verification prompt
- ✅ Verified users can search immediately

---

## Edge Cases

### E1. Network Interruption
- Test with slow/unstable network
- Verify retries or graceful failure

### E2. Database Connection Loss
- Temporarily disable Supabase
- Verify error handling

### E3. Render Cold Start
- First request after 15+ minutes of inactivity
- Verify 50+ second delay handled gracefully

### E4. Invalid Input
- Special characters in job title
- Empty location
- Negative `results_wanted`

---

## Automated Test Suite

### Unit Tests (Python)
```python
# test_api.py

def test_single_site_search():
    """Test single job board request"""
    pass

def test_multi_site_search():
    """Test all job boards request"""
    pass

def test_site_failure_handling():
    """Test one site failing doesn't crash others"""
    pass

def test_log_final_status():
    """Test status determination logic"""
    pass
```

### Integration Tests (Next.js)
```typescript
// api.test.ts

describe('JobService', () => {
  it('should make single API call for all job boards', async () => {
    // Mock fetch
    // Call searchAllJobBoards()
    // Verify single fetch call with all sites
  });

  it('should poll database for status updates', async () => {
    // Start search
    // Mock database polling
    // Verify polling interval
  });
});
```

---

## Success Criteria

All tests must pass with:
- ✅ 0 syntax errors
- ✅ 0 database errors
- ✅ 0 CORS errors
- ✅ 100% search completion rate (when backend is healthy)
- ✅ < 2 minute completion time for typical searches
- ✅ Proper status updates in all scenarios

---

## Known Limitations

1. **Render Free Tier**: Cold start delays (50+ seconds)
2. **HTTP Timeout**: 30 seconds per request (mitigated by 2min proxy timeout)
3. **Rate Limiting**: Job boards may throttle requests
4. **Duplicate Detection**: Only by exact title + company match

---

## Rollback Plan

If critical issues found:
1. Revert frontend `api.ts` to loop-based architecture
2. Revert backend `main.py` to process all sites together
3. Re-enable `increment_only` parameter
4. Deploy hotfix to Render

Rollback files:
- Git commit before refactor: `<commit-hash>`
- Backup files: `api.ts.backup`, `main.py.backup`
