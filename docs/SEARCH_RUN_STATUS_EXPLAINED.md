# Search Run Status Explained

## What is `search_runs` table?

The `search_runs` table tracks every job search request in the database. It's used for:
- Cross-device search visibility
- Search history
- Analytics
- Future automated/scheduled searches

## Status Lifecycle

### `pending` 
**Meaning:** Search request created, waiting to be processed

**When it happens:**
- Immediately when user clicks "Search" button
- Search run record created in database
- Waiting for the worker (Render API) to pick it up

**Duration:** Usually < 1 second (until Render starts processing)

---

### `running`
**Meaning:** Search is actively being executed

**When it happens:**
- Render API starts scraping job boards
- Render calls `updateSearchRunStatus()` to mark as 'running'
- Jobs are being fetched from LinkedIn, Indeed, etc.

**Duration:** 30 seconds - 2 minutes (depending on job board and results)

---

### `success`
**Meaning:** Search completed successfully

**When it happens:**
- All jobs fetched and saved to database
- Render updates status to 'success'
- `jobs_found` field populated with count

**What triggers redirect:**
- Frontend receives real-time update via Supabase
- Automatic redirect to `/results` page
- Notification: "Found X jobs"

---

### `failed`
**Meaning:** Search encountered an error

**When it happens:**
- Network error connecting to job boards
- Timeout (search took too long)
- API error from job board
- Render service crashed

**What happens:**
- `error_message` field populated with details
- Frontend shows error notification
- User can retry search

---

## Why Duplicates Were Happening

### The Problem (Before Fix)

When searching "All Job Boards":
```
User clicks "Search" with site="all"
  ↓
searchAllJobBoards() loops through [LinkedIn, Indeed]
  ↓
For LinkedIn:
  - searchJobs(site="linkedin", userId) → Creates search_run #1
  ↓
For Indeed:
  - searchJobs(site="indeed", userId) → Creates search_run #2
```

**Result:** 2 search runs with identical parameters (except site)

### The Fix (After)

Now "All Job Boards" creates ONE search run:
```
User clicks "Search" with site="all"
  ↓
searchAllJobBoards() creates ONE search_run with site="all"
  ↓
Status: pending → running
  ↓
Loops through [LinkedIn, Indeed]:
  - searchJobs(site="linkedin", skipSearchRunCreation=true)
  - searchJobs(site="indeed", skipSearchRunCreation=true)
  ↓
All jobs collected
  ↓
Update search_run: running → success (with total jobs_found)
```

**Result:** 1 search run for the entire "all job boards" search

---

## Status Transitions Example

### Successful Single Job Board Search
```
1. User clicks "Search" (LinkedIn)
   → status: pending (created_at: 14:30:00)

2. Render starts scraping
   → status: running (started_at: 14:30:01)

3. Jobs found and saved
   → status: success (completed_at: 14:30:45, jobs_found: 23)

4. Frontend redirects to /results
```

### Successful "All Job Boards" Search
```
1. User clicks "Search" (All job boards)
   → status: pending (created_at: 14:30:00, site: "all")

2. Start scraping both boards
   → status: running (started_at: 14:30:01)

3. LinkedIn done (12 jobs), Indeed done (15 jobs)
   → status: success (completed_at: 14:31:30, jobs_found: 27)
   Note: Duplicates removed, so 27 instead of 12+15

4. Frontend redirects to /results
```

### Failed Search
```
1. User clicks "Search"
   → status: pending

2. Render starts
   → status: running

3. Network error to job board
   → status: failed
   → error_message: "Failed to fetch: Network error"

4. Frontend shows error notification
```

---

## How to Check Search Runs

### Get All Search Runs for a User
```sql
SELECT 
  id,
  status,
  parameters->>'site' as site,
  parameters->>'jobTitle' as job_title,
  jobs_found,
  error_message,
  created_at,
  started_at,
  completed_at,
  EXTRACT(EPOCH FROM (completed_at - created_at)) as duration_seconds
FROM search_runs
WHERE user_id = '<user-id>'
ORDER BY created_at DESC
LIMIT 10;
```

### Get Currently Active Searches
```sql
SELECT 
  id,
  user_id,
  status,
  parameters,
  created_at,
  EXTRACT(EPOCH FROM (NOW() - created_at)) as elapsed_seconds
FROM search_runs
WHERE status IN ('pending', 'running')
ORDER BY created_at DESC;
```

### Check for Stuck Searches (Running > 5 minutes)
```sql
SELECT *
FROM search_runs
WHERE status IN ('pending', 'running')
  AND created_at < NOW() - INTERVAL '5 minutes';
```

---

## Common Issues

### Issue: Search stuck in "pending"
**Cause:** Render service not responding or hibernating  
**Fix:** Check Render dashboard, manually wake service

### Issue: Search stuck in "running"
**Cause:** Render crashed mid-search or network timeout  
**Fix:** 
```sql
-- Manually mark as failed
UPDATE search_runs 
SET status = 'failed', 
    error_message = 'Search timeout - manually resolved',
    completed_at = NOW()
WHERE id = '<search-run-id>';
```

### Issue: Multiple search runs for same search
**Cause:** Was creating one per job board in "all" searches  
**Fix:** Applied in this update - now creates one search run for "all"

---

## Code Changes Made

### Before
- `searchJobs()` always created a search_run
- `searchAllJobBoards()` called `searchJobs()` for each site
- Result: N search runs for "all job boards" (N = number of sites)

### After
- `searchJobs()` accepts `skipSearchRunCreation` parameter
- `searchAllJobBoards()` creates ONE search_run with `site: "all"`
- Individual site searches skip search_run creation
- Result: 1 search run for "all job boards"

### Benefits
✅ No more duplicate search runs  
✅ Cleaner search history  
✅ Easier to track cross-device searches  
✅ Accurate `jobs_found` count (after deduplication)  
✅ Proper status tracking for multi-board searches
