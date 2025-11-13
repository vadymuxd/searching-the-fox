# Bug Fixes - November 13, 2025

## Bug 1: Homepage Loading State Not Showing ✅ FIXED

### Problem
When users clicked "Search" from homepage, the LoadingInsight and Timer components were not displaying.

### Root Cause
During the SearchRunning component implementation, we removed the inline loading state to use the global component. However, this created a poor UX where users saw no feedback when initiating a search.

### Solution
Restored the inline loading state on the homepage while keeping the global SearchRunning component for cross-page visibility.

### Changes Made
**File: `/src/app/page.tsx`**
- ✅ Re-added `LoadingInsight` and `Timer` imports
- ✅ Restored `progressInfo` state
- ✅ Restored `showLoadingState` calculation
- ✅ Restored loading UI with LoadingInsight, Timer, and progress info
- ✅ Restored progress callback for multi-site searches

### Result
Now users see immediate feedback when clicking "Search":
1. Homepage shows LoadingInsight + Timer inline
2. Global SearchRunning component appears in top-right
3. Both show search progress until completion
4. Page auto-refreshes when done

---

## Bug 2: Render API - Date Posted Database Error ✅ FIXED

### Problem
```
ERROR - Error inserting job: {'code': '22007', 'message': 'invalid input syntax for type timestamp with time zone: "None"'}
```

Search runs were not being marked as "success" or "failed" because all jobs failed to save to the database.

### Root Cause
1. JobSpy was returning `None` for `date_posted` on some jobs
2. When converted to string with `str()`, it became `"None"` (string)
3. PostgreSQL timestamp columns reject the string `"None"`
4. All 40 jobs failed to insert
5. `saved_count` was 0
6. Search was still marked as "success" with 0 jobs

### Solution
**Two-part fix:**

#### Part 1: Clean date_posted Before DB Insert
**File: `/jobspy-service/main.py` - `save_job_to_database()`**
```python
# Prepare date_posted - convert None to null, not string "None"
date_posted = job_data.get("date_posted")
if date_posted is None or date_posted == "None" or date_posted == "":
    date_posted = None  # Explicitly set to None (will be NULL in DB)
```

#### Part 2: Prevent "None" String at Source
**File: `/jobspy-service/main.py` - Job scraping**
```python
date_posted=str(job.date_posted) if (
    hasattr(job, 'date_posted') 
    and str(job.date_posted) != 'nan' 
    and str(job.date_posted) != 'None'  # Added check
) else None,
```

#### Part 3: Better Error Handling
**File: `/jobspy-service/main.py` - Search run status**
```python
# If we found jobs but saved 0, mark as failed with explanation
if len(jobs_list) > 0 and saved_count == 0:
    update_search_run_status(
        request.run_id, 
        "failed", 
        error=f"Found {len(jobs_list)} jobs but failed to save any to database.",
        jobs_found=0
    )
else:
    update_search_run_status(request.run_id, "success", jobs_found=saved_count)
```

### Changes Made
**File: `/jobspy-service/main.py`**
- ✅ Added `date_posted` cleaning in `save_job_to_database()` function (line ~205)
- ✅ Added "None" string check in JobResponse creation (line ~420)
- ✅ Improved search_run status logic to mark as failed if 0 jobs saved (line ~455)

---

## Deployment Steps

### 1. Deploy Frontend Changes (Vercel)
Frontend changes will auto-deploy on git push to main branch. No manual action needed.

### 2. Deploy Render API Changes (IMPORTANT!)

The Python service changes need to be deployed to Render:

**Option A: Via Render Dashboard (Recommended)**
1. Go to https://dashboard.render.com
2. Find your `truelist-jobspy-api` service
3. Click "Manual Deploy" → "Deploy latest commit"
4. Wait for deployment to complete (~2-3 minutes)

**Option B: Via Git Push (If auto-deploy is enabled)**
```bash
cd jobspy-service
git add main.py
git commit -m "Fix date_posted database error and improve error handling"
git push origin main
```

**Option C: Direct File Edit on Render**
If you have access to the Render shell, you can edit the file directly, but git deployment is preferred.

### 3. Verify Fixes

**Test the date_posted fix:**
1. Initiate a search from localhost or production
2. Check Render logs - should no longer see "invalid input syntax" errors
3. Verify jobs are being saved (check `saved_count` in logs)
4. Confirm search_run status updates to "success" with correct job count

**Test the loading state:**
1. Go to homepage
2. Click "Search"
3. Should see LoadingInsight and Timer immediately
4. Global SearchRunning should also appear top-right
5. Both should update until search completes

---

## Files Changed

### Frontend
- `/src/app/page.tsx` - Restored inline loading state

### Backend (Render)
- `/jobspy-service/main.py` - Fixed date_posted handling and error reporting

---

## Testing Checklist

- [ ] Homepage shows LoadingInsight + Timer when search starts
- [ ] Global SearchRunning component appears in top-right
- [ ] No "invalid input syntax for type timestamp" errors in Render logs
- [ ] Jobs are successfully saved to database (check logs: "Saved X out of Y jobs")
- [ ] Search runs marked as "success" with correct job count
- [ ] Search runs marked as "failed" if 0 jobs saved despite finding some
- [ ] Page auto-refreshes when search completes
- [ ] Works for both single site and "all boards" searches
