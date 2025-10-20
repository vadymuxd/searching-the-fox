# date_posted NULL Handling Review & Fix

## Overview
This document details the review and fix for handling NULL `date_posted` values when moving job data from localStorage/JobSpy API to the database jobs table.

## Problem Statement
When jobs are retrieved from the JobSpy API and stored in localStorage, some jobs may have a NULL or invalid `date_posted` value. Previously, these NULL values were passed directly to the database, leaving the `date_posted` field empty. This could cause issues with:
- Job sorting and filtering by date
- User experience when viewing job posting dates
- Analytics and reporting on job recency

## Solution
Added automatic date handling to assign **today's date** when `date_posted` is NULL or invalid.

## Implementation Details

### File Modified
- **Path**: `src/lib/db/jobService.ts`
- **Function**: `mapJobToDatabase()` (internal mapping function)
- **New Helper**: `getDatePostedOrToday()` (utility function)

### How It Works

#### New Helper Function: `getDatePostedOrToday()`
```typescript
function getDatePostedOrToday(datePosted: string | null | undefined): string {
  // If date_posted is provided and valid, use it
  if (datePosted) {
    try {
      const date = new Date(datePosted);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    } catch {
      // Fall through to use today's date
    }
  }
  
  // If date_posted is NULL or invalid, use today's date
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Set to start of day for consistency
  return today.toISOString();
}
```

**Logic:**
1. ✅ If `date_posted` is provided and valid: Use it (converted to ISO format)
2. ❌ If `date_posted` is NULL, undefined, or invalid: Use today's date at 00:00:00
3. Always returns a string (never NULL)

#### Updated `mapJobToDatabase()` Function
The mapping function now uses this helper:
```typescript
date_posted: getDatePostedOrToday(job.date_posted),
```

**Before:**
```typescript
date_posted: job.date_posted ? (() => {
  try {
    const date = new Date(job.date_posted);
    return isNaN(date.getTime()) ? null : date.toISOString();
  } catch {
    return null;
  }
})() : null,
```

**After:**
```typescript
date_posted: getDatePostedOrToday(job.date_posted),
```

### Data Flow

```
JobSpy API Response
        ↓
Job Data in Frontend (localStorage)
  - date_posted: null OR valid date
        ↓
User clicks "Save to Database"
        ↓
saveJobsToDatabase() function
        ↓
mapJobToDatabase() processes each job
        ↓
getDatePostedOrToday() function
  - If NULL/invalid → Assigns TODAY's date
  - If valid → Uses provided date
        ↓
Jobs inserted into 'jobs' table
  - date_posted: ALWAYS has a value
```

## Benefits

1. ✅ **No NULL values in database** - Ensures all jobs have a posting date
2. ✅ **Better sorting** - Jobs can be sorted by date_posted reliably
3. ✅ **Consistent behavior** - Jobs with missing dates are clearly marked as "today"
4. ✅ **Improved filtering** - Date-based filters work as expected
5. ✅ **Better UX** - Users always see a date for every job

## Database Schema Impact

The `jobs` table `date_posted` field:
- **Type**: `TIMESTAMPTZ`
- **Before**: Could be NULL if JobSpy API returns NULL
- **After**: Always has a value (either from API or today's date)

```sql
-- Column definition in jobs table
date_posted TIMESTAMPTZ,
```

## Testing Recommendations

1. **Test with valid date_posted**
   - Search for jobs and verify they retain their original posting date

2. **Test with NULL date_posted**
   - Manually test with a job that has NULL date_posted
   - Verify it gets today's date in the database
   - Check that it displays correctly in the UI

3. **Test with invalid date formats**
   - Add tests for malformed date strings
   - Verify they fall back to today's date

4. **Database verification**
   ```sql
   SELECT job_url, date_posted, created_at 
   FROM jobs 
   WHERE date(date_posted) = CURRENT_DATE
   LIMIT 5;
   ```

## Related Components

### Files using this function:
1. **`src/lib/db/jobService.ts`** - Handles all database operations
   - `saveJobsToDatabase()` - Calls mapJobToDatabase()
   
2. **`src/lib/jobsDataManager.ts`** - Manages job cache and sync
   - `saveNewJobsAndSync()` - Initiates database save

3. **`src/lib/api.ts`** - Fetches jobs from JobSpy API
   - `searchJobs()` - Returns jobs that may have NULL date_posted
   - `searchAllJobBoards()` - Searches multiple boards

### Job Type Definition:
- **`src/types/job.ts`** - Defines Job interface with date_posted field

## Future Improvements

1. **Consider storing original API response date** - Could add a field to track if date was inferred
2. **Add logging** - Log instances where NULL date_posted is converted
3. **User notification** - Optionally notify user that date was not available
4. **Improved date logic** - Could use `user_jobs.created_at` as fallback instead of today

## Deployment Notes

- ✅ No database migrations needed
- ✅ Backward compatible with existing data
- ✅ No breaking changes to API
- ✅ Purely client-side transformation before insert

## Files Changed

| File | Changes |
|------|---------|
| `src/lib/db/jobService.ts` | Added `getDatePostedOrToday()` function, updated `mapJobToDatabase()` to use it |

---

**Last Updated**: October 20, 2025  
**Status**: ✅ Complete
