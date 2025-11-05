# Job Fetching Optimization - Prioritized Status Queries

## Overview

Improved the job fetching logic to prioritize active jobs over archived ones, ensuring the 1000-job limit is filled with the most relevant jobs first. Additionally, enhanced job saving to handle large batches and ensure ALL jobs are saved to the database before fetching for display.

## Problems Solved

### Problem 1: Inefficient Job Fetching Order

Previously, the system fetched jobs with a simple query ordered by `created_at`, which meant that if a user had more than 1000 jobs, the results were limited by Supabase's default 1000-row limit. This could result in:
- Active jobs (interested, applied, progressed) being excluded from the results
- The 1000-job limit being filled with older "new" or "archived" jobs
- Users unable to see jobs they're actively tracking

### Problem 2: Batch Insert Limitations

When saving large numbers of jobs (e.g., 500+ new jobs from a search):
- Supabase `.in()` queries have practical limits on array sizes
- Single large inserts could fail or hit timeout limits
- No clear logging to confirm all jobs were saved
- Risk of partial saves if user had many existing jobs

**Critical Scenario:**
```
User has: 100 new + 50 (interested/applied/rejected) + 650 archived = 800 total
New search returns: 500 jobs
Total after search: 1300 jobs in database

Without batching:
- Insert of 500 jobs might fail due to query limits
- .in('job_url', [500 urls]) could hit size limits
- .in('job_id', [1300 ids]) to check user_jobs could fail

Result: Some jobs lost or not associated with user
```

## Solutions Implemented

### Solution 1: Prioritized Fetching Strategy

Implemented a **prioritized fetching strategy** that queries jobs in order of importance:

#### Priority Order

1. **High Priority** (fetched first)
   - `interested`
   - `applied` 
   - `progressed`

2. **Medium Priority**
   - `new`

3. **Low Priority**
   - `rejected`

4. **Lowest Priority** (fetched last)
   - `archived`

#### How It Works

```typescript
// Fetch jobs in priority order to reach 1000 total
const MAX_JOBS = 1000;
const allJobs: Job[] = [];

const priorityStatuses = [
  ['interested', 'applied', 'progressed'], // High priority
  ['new'],                                  // Medium priority
  ['rejected'],                             // Low priority
  ['archived']                              // Lowest priority
];

// Fetch each priority group until we reach 1000 jobs
for (const statusGroup of priorityStatuses) {
  if (allJobs.length >= MAX_JOBS) break;
  
  const remainingLimit = MAX_JOBS - allJobs.length;
  // Fetch jobs for this status group...
}
```

### Solution 2: Batch Processing for Large Saves

Enhanced `saveJobsToDatabase()` to handle large batches safely:

#### Key Features

1. **Batch Size Control**: Processes jobs in batches of 500
2. **Comprehensive Logging**: Tracks progress at each step
3. **Error Resilience**: Continues processing even if one batch has issues
4. **Query Optimization**: Splits large `.in()` queries into manageable chunks

#### Implementation

```typescript
function batchArray<T>(array: T[], batchSize: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < array.length; i += batchSize) {
    batches.push(array.slice(i, i + batchSize));
  }
  return batches;
}

// Process job URLs in batches
const jobUrlBatches = batchArray(jobUrls, 500);
for (const urlBatch of jobUrlBatches) {
  // Fetch existing jobs for this batch
  const { data } = await supabase
    .from('jobs')
    .select('id, job_url')
    .in('job_url', urlBatch);
  // ...
}
```

#### Logging Example

```
[saveJobsToDatabase] Starting to save 500 jobs for user abc123
[saveJobsToDatabase] Found 150 existing jobs in database
[saveJobsToDatabase] 350 new jobs to insert, 150 already exist
[saveJobsToDatabase] Inserting batch 1/1 (350 jobs)
[saveJobsToDatabase] Total job IDs to process: 500
[saveJobsToDatabase] 350 new user_jobs entries to create, 150 already exist
[saveJobsToDatabase] Inserting user_jobs batch 1/1 (350 entries)
[saveJobsToDatabase] Successfully saved 500 jobs total
```

### Solution 3: Enhanced Sync Flow

Updated `saveNewJobsAndSync()` to ensure proper save-then-fetch flow:

1. **Save ALL jobs first** (no limit, with batching)
2. **Log success** with count of jobs saved
3. **Then fetch** prioritized 1000 jobs for display/cache
4. **Graceful degradation**: Even if sync fails, jobs are already saved

```typescript
async saveNewJobsAndSync(jobs: Job[], userId: string, searchData: SearchFormData) {
  // Save ALL jobs to database (no limit, batched)
  const result = await saveJobsToDatabase(jobs, userId);
  console.log(`Successfully saved ${result.jobsSaved} jobs to database`);
  
  // Fetch prioritized 1000 for display
  const syncResult = await this.syncWithDatabase(userId, undefined, true);
  console.log(`Fetched ${syncResult.jobs.length} jobs for cache`);
  
  return { success: true, jobsSaved: result.jobsSaved };
}
```

## Benefits

✅ **Always shows active jobs**: Users will always see jobs they're actively tracking  
✅ **Better UX**: Most relevant jobs appear in the interface first  
✅ **Efficient**: Uses same 1000-job limit but fills it intelligently  
✅ **Backwards compatible**: Existing code continues to work without changes  
✅ **Resilient**: Handles errors gracefully by continuing to next priority group  
✅ **Handles large batches**: Can save 500+ jobs without hitting query limits  
✅ **Complete saves**: ALL jobs are saved to database, not just first 1000  
✅ **Better visibility**: Console logs track exactly what's happening  
✅ **No data loss**: Batching ensures even large searches are fully saved  

## Technical Implementation

### Files Modified

1. **`src/lib/db/jobService.ts`**
   - Added `batchArray()` helper function
   - Enhanced `saveJobsToDatabase()` with batch processing
   - Updated `getUserJobs()` with prioritized fetching

2. **`src/lib/jobsDataManager.ts`**
   - Enhanced `saveNewJobsAndSync()` with better logging
   - Added `jobsSaved` to return type for confirmation
   - Improved error handling and reporting

### Key Changes

#### 1. Batch Processing in saveJobsToDatabase()

- **Before**: Single query for all jobs
- **After**: Processes in batches of 500
- **Benefit**: Avoids query size limits and timeouts

```typescript
// Check existing jobs in batches
const jobUrlBatches = batchArray(jobUrls, 500);
for (const urlBatch of jobUrlBatches) {
  const { data } = await supabase.from('jobs')
    .select('id, job_url')
    .in('job_url', urlBatch);
  allExistingJobs.push(...data);
}
```

#### 2. Status-specific vs All-jobs Queries

- **Status-specific**: Fetch only that status (up to 1000)
- **All-jobs**: Use priority fetching across status groups

#### 3. Comprehensive Logging

Every step now logs progress:
- Job counts at each stage
- Batch progress
- Success/failure indicators
- Final confirmation

#### 4. Maintains Same Return Format

- Returns same data structure as before
- Added optional `jobsSaved` count
- No breaking changes to consuming code

## Testing Recommendations

### Test Cases

#### Test 1: User with < 1000 jobs total
- **Setup**: User has 600 total jobs
- **Expected**: All jobs returned in priority order

#### Test 2: User with > 1000 jobs, all statuses represented
- **Setup**: 
  - 50 interested/applied/progressed
  - 300 new
  - 200 rejected
  - 600 archived
  - Total: 1150 jobs
- **Expected**: 
  - Returns all 50 interested/applied/progressed
  - Returns all 300 new
  - Returns all 200 rejected  
  - Returns 450 archived (to reach 1000 limit)

#### Test 3: Large new search results
- **Setup**:
  - User has: 100 new + 50 interested/applied/rejected + 650 archived = 800 total
  - New search returns: 500 jobs
  - Total after search: 1300 jobs
- **Expected**:
  - ALL 500 new jobs saved to database ✅
  - Fetch returns: 50 interested/applied/rejected + 950 new = 1000 jobs
  - Console shows: "Successfully saved 500 jobs total"

#### Test 4: Very large search (edge case)
- **Setup**:
  - User has: 200 existing jobs
  - New search returns: 800 jobs
  - Total after search: 1000 jobs
- **Expected**:
  - ALL 800 jobs saved in batches (2 batches of 500 each)
  - Console shows batch progress
  - All 1000 jobs returned for display

#### Test 5: Specific status query
- **Setup**: User has 1200 "new" jobs
- **Query**: Fetch status="new"
- **Expected**: Returns first 1000 "new" jobs

#### Test 6: Error handling
- **Setup**: Simulate partial network failure
- **Expected**: Completed batches are saved, error logged, graceful degradation

### Expected Results

#### Before optimization:
```
User has 1500 jobs:
- 50 interested, 30 applied, 20 progressed  
- 800 new
- 100 rejected
- 500 archived

Search returns 500 new jobs → Total: 2000 jobs

Old behavior: 
- Might fail to save all 500 jobs (query limits)
- First 1000 by created_at (random mix, might miss active jobs)
- No confirmation of what was saved
```

#### After optimization:
```
User has 1500 jobs:
- 50 interested, 30 applied, 20 progressed
- 800 new
- 100 rejected
- 500 archived

Search returns 500 new jobs → Total: 2000 jobs

New behavior:
✅ ALL 500 new jobs saved to database (batched)
✅ Console: "Successfully saved 500 jobs total"
✅ Fetch for display returns:
   - 50 interested, 30 applied, 20 progressed (all)
   - 900 new (prioritized from 1300 total new jobs)
   - 0 rejected (limit reached)
   - 0 archived (limit reached)
✅ All 2000 jobs remain in database for future access
```

### Monitoring & Debugging

Check browser console for detailed logs:

```
[saveJobsToDatabase] Starting to save 500 jobs for user abc123
[saveJobsToDatabase] Found 150 existing jobs in database
[saveJobsToDatabase] 350 new jobs to insert, 150 already exist
[saveJobsToDatabase] Inserting batch 1/1 (350 jobs)
[saveJobsToDatabase] Total job IDs to process: 500
[saveJobsToDatabase] 350 new user_jobs entries to create, 150 already exist
[saveJobsToDatabase] Inserting user_jobs batch 1/1 (350 entries)
[saveJobsToDatabase] Successfully saved 500 jobs total
[saveNewJobsAndSync] Successfully saved 500 jobs to database
[saveNewJobsAndSync] Syncing to fetch prioritized jobs for display
[saveNewJobsAndSync] Sync complete, fetched 1000 jobs for cache
```

## Future Improvements

Potential enhancements for later:

1. **Pagination**: Implement cursor-based pagination to fetch more than 1000 jobs on demand
2. **Configurable limits**: Allow users to customize job limits per status
3. **Smart caching**: Cache priority jobs more aggressively than archived ones
4. **Analytics**: Track which status groups hit their limits most often

## Related Files

- `src/lib/jobsDataManager.ts` - Manages job caching and sync
- `src/components/JobsPageContent.tsx` - Displays fetched jobs
- `docs/STAGE_7_DATABASE_INTEGRATION.md` - Original database integration docs
