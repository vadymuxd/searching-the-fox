# Backend Orchestration Architecture Refactor

## Problem Statement

**Critical Issue**: Frontend was orchestrating multiple API calls for multi-site job searches. If a user closed their browser mid-search, the remaining job boards would not be processed, resulting in incomplete searches.

**Old Architecture**:
```
Frontend → Loop through sites → API call per site → Database update per site
```

**Failure Scenario**:
- User searches "All job boards"
- Frontend calls API for LinkedIn (success)
- Frontend calls API for Indeed (in progress...)
- User closes browser window ❌
- Indeed search never completes
- Database status stuck on "running"

## Solution: Backend Self-Contained Processing

**New Architecture**:
```
Frontend → Single API call (all sites) → Backend processes all sites → Database updates progressively
Frontend → Poll database for status updates (independent of API)
```

**Success Scenario**:
- User searches "All job boards"
- Frontend makes ONE API call with `site_name: ['linkedin', 'indeed']`
- Frontend starts polling database immediately
- Backend processes LinkedIn → saves jobs → updates database
- Backend processes Indeed → saves jobs → updates database
- Backend marks search as complete
- User can close browser at any time - search continues on backend ✓

## Key Changes

### Frontend (api.ts)

**Before**:
```typescript
// Loop through sites, make separate API calls
for (let i = 0; i < INDIVIDUAL_SITES.length; i++) {
  const site = INDIVIDUAL_SITES[i];
  const isLastSite = i === INDIVIDUAL_SITES.length - 1;
  await this.searchJobs(siteParams, userId, true, searchRunId, !isLastSite);
}
```

**After**:
```typescript
// Single API call with all sites
const sitesToSearch = INDIVIDUAL_SITES.map(s => s.value);
const requestBody = {
  site_name: sitesToSearch, // ['linkedin', 'indeed']
  // ... other params
};
await fetch(endpoint, { method: 'POST', body: JSON.stringify(requestBody) });
```

**Removed**:
- `increment_only` parameter (no longer needed)
- Multi-site orchestration loop
- Progressive status updates from frontend

### Backend (main.py)

**Before**:
```python
# Process all sites together in one JobSpy call
jobs_df = scrape_jobs(
    site_name=request.site_name,  # All sites at once
    # ...
)
# Process results
# Update database once
```

**After**:
```python
# Process each site sequentially
for i, site_name in enumerate(sites_to_process):
    # Call JobSpy for this site
    jobs_df = scrape_jobs(
        site_name=[site_name],  # One site at a time
        # ...
    )
    # Process jobs for this site
    # Save to database
    # Update status (increment jobs_found)
    # Continue to next site even if this one fails

# After all sites processed
log_final_status(site_statuses, total_jobs, False, run_id)
```

**Key Features**:
- Sequential processing (one site at a time)
- Per-site error handling (one failure doesn't stop others)
- Progressive database updates (jobs saved immediately after each site)
- Comprehensive logging with site-specific status tracking
- Final status determined by `log_final_status()` function

## Database Update Strategy

### Progressive Updates

During multi-site search, backend updates database after each site:

```python
# After each site completes
update_search_run_status(run_id, "", jobs_found=saved_count, increment_only=True)
```

**Parameters**:
- `increment_only=True`: Adds to `jobs_found` without changing status
- Allows accumulation of jobs across multiple sites
- Status remains "running" until final update

### Final Update

After all sites processed:

```python
# In log_final_status() function
if not increment_only:
    # Determine overall status
    if all_completed:
        status = "SUCCESS"
    elif some_completed:
        status = "PARTIAL SUCCESS"
    else:
        status = "FAILED"
    
    # Update database with final status
    update_search_run_status(run_id, status)
```

## Site Status Tracking

Backend maintains detailed status for each job board:

```python
site_statuses = {
    'linkedin': 'completed: 45 jobs',
    'indeed': 'failed: connection timeout',
}
```

**Logged Summary**:
```
================================================================================
JOB SCRAPING SUMMARY
================================================================================
  ✓ LinkedIn: completed: 45 jobs
  ✗ Indeed: failed: connection timeout
--------------------------------------------------------------------------------
Overall Status: PARTIAL SUCCESS
Job Boards: 1 completed, 1 failed, 0 pending
Total Jobs Found: 45
Increment Only Mode: No (Final Update)
================================================================================
```

## Benefits

1. **Reliability**: Search completes even if user closes browser
2. **Transparency**: Detailed per-site status tracking
3. **Robustness**: One site failure doesn't prevent others from processing
4. **Scalability**: Easy to add more job boards
5. **Maintainability**: Single source of truth (database) for status
6. **User Experience**: Frontend polls database for real-time updates

## Testing Checklist

- [ ] Single job board search (LinkedIn only)
- [ ] Single job board search (Indeed only)
- [ ] Multi-site search (All job boards)
- [ ] Multi-site search with one site failing
- [ ] User closes browser mid-search (verify search completes)
- [ ] Database status updates correctly
- [ ] Frontend SearchRunning component reflects database status
- [ ] Page refresh shows correct status from database
- [ ] Zero jobs found scenario
- [ ] All sites fail scenario

## Migration Notes

**Breaking Changes**:
- Removed `increment_only` parameter from API request
- Frontend no longer receives progress updates from API
- Frontend must poll database for status (already implemented)

**Backward Compatibility**:
- Single-site searches work unchanged
- Database schema unchanged
- SearchRunning component already polls database

## Future Enhancements

1. **Background Jobs**: Move to Vercel Cron or external worker
2. **Webhooks**: Notify frontend when search completes
3. **Rate Limiting**: Per-site rate limiting to avoid blocking
4. **Retry Logic**: Automatic retry for failed sites
5. **Site Prioritization**: Process high-success-rate sites first
