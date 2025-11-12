# Release 4 Testing Guide - Cross-Device Search Status Visibility

## Overview
Release 4 enables users to see their ongoing search status even after closing the app or switching devices. This is achieved through:

1. **`useSearchStatus` hook** - Monitors active search runs and provides real-time updates
2. **Updated Timer component** - Supports resuming from persisted elapsed time
3. **Updated home page** - Shows loading state for active searches across devices

## What's New

### Features Implemented
- ✅ Automatic detection of active search runs on page load
- ✅ Real-time status updates via Supabase subscriptions
- ✅ Timer resume functionality (shows correct elapsed time)
- ✅ Cross-device search visibility
- ✅ Automatic redirect to results when search completes
- ✅ Error notifications when search fails
- ✅ Search parameter display from persisted runs

### Files Modified
- `src/hooks/useSearchStatus.tsx` (new) - Main hook for managing search status
- `src/app/page.tsx` - Integrated useSearchStatus hook
- `src/components/Timer.tsx` - Added support for initial elapsed time
- `src/lib/db/searchRunService.ts` - Already has required functions from Release 2

## Testing Scenarios

### Test 1: Same Device Continuation ✓

**Goal:** Verify that closing and reopening the browser on the same device shows active search status

**Steps:**
1. Log in as a test user
2. Navigate to home page
3. Initiate a search: "Software Engineer" in "London"
4. Wait ~10 seconds for the search to start running
5. **Close the browser tab completely** (don't just refresh)
6. Wait 30 seconds
7. Open a new browser tab and navigate to the app
8. Log in if needed

**Expected Results:**
- ✅ Home page automatically shows loading state
- ✅ LoadingInsight displays random job insights
- ✅ Timer shows correct elapsed time (should be ~40+ seconds)
- ✅ Status message shows "Searching..." with job board name
- ✅ When search completes, notification appears
- ✅ Automatic redirect to /results page
- ✅ Jobs appear in results page

**Verification Queries:**
```sql
-- Check the search run status
SELECT id, status, created_at, started_at, completed_at, jobs_found, 
       EXTRACT(EPOCH FROM (completed_at - created_at)) as duration_seconds
FROM search_runs 
WHERE user_id = '<test-user-id>' 
ORDER BY created_at DESC 
LIMIT 1;
```

---

### Test 2: Cross-Device Continuation ✓

**Goal:** Verify that searches started on one device are visible on another device

**Setup:** You'll need two devices or two different browsers (e.g., Chrome and Firefox)

**Steps:**
1. **Device 1 (e.g., Desktop Chrome):**
   - Log in as test user
   - Initiate search: "Product Manager" in "Manchester"
   - Wait ~10 seconds for search to start
   - **Leave this tab open** (so you can see it's running)

2. **Device 2 (e.g., Mobile Safari or Desktop Firefox):**
   - Open the app in a new browser/device
   - Log in with the same test user account
   - Navigate to home page

**Expected Results on Device 2:**
- ✅ Home page immediately shows loading state
- ✅ LoadingInsight appears with job insights
- ✅ Timer shows elapsed time matching Device 1
- ✅ Search parameters from Device 1 are displayed
- ✅ When search completes, both devices receive notification
- ✅ Both devices redirect to /results
- ✅ Same jobs appear on both devices

**Verification:**
```sql
-- Check that both sessions see the same search run
SELECT id, status, parameters, 
       client_context->>'device' as device_info,
       created_at
FROM search_runs 
WHERE user_id = '<test-user-id>' 
  AND status IN ('pending', 'running')
ORDER BY created_at DESC;
```

---

### Test 3: Failed Search Recovery ✓

**Goal:** Verify that failed searches show error messages and allow retry

**Steps:**
1. Log in as test user
2. Modify the Render API to simulate a failure (or wait for a natural failure)
   - Alternative: Use invalid search parameters that might cause issues
3. Initiate a search
4. Close the browser tab while search is running
5. Wait for the search to fail (check Supabase)
6. Reopen the app and log in

**Expected Results:**
- ✅ Home page shows loading state initially
- ✅ When failure is detected, error notification appears
- ✅ Error message from `error_message` field is displayed
- ✅ Loading state clears
- ✅ User returns to normal search form
- ✅ User can initiate a new search
- ✅ Failed search is recorded in database

**Verification:**
```sql
-- Check failed search run
SELECT id, status, error_message, parameters, 
       created_at, started_at, completed_at
FROM search_runs 
WHERE user_id = '<test-user-id>' 
  AND status = 'failed'
ORDER BY created_at DESC 
LIMIT 1;
```

---

### Test 4: Real-time Status Updates (Supabase Realtime) ✓

**Goal:** Verify that status changes are received in real-time without polling

**Steps:**
1. Log in as test user
2. Open browser DevTools → Console tab
3. Initiate a search
4. Watch the console logs for real-time updates

**Expected Console Logs:**
```
[useSearchStatus] Checking for active search run for user: <user-id>
[useSearchStatus] Found active run: <run-id> Status: pending
[useSearchStatus] Subscribing to run: <run-id>
[useSearchStatus] Status update: running Previous: pending
[useSearchStatus] Search started running
[useSearchStatus] Status update: success Previous: running
[useSearchStatus] Search completed successfully
```

**Expected Results:**
- ✅ Console shows subscription to search run
- ✅ Status transitions are logged: pending → running → success
- ✅ UI updates immediately when status changes
- ✅ No polling (just Supabase realtime events)

---

### Test 5: Multiple Users (Isolation) ✓

**Goal:** Verify that users only see their own search runs

**Steps:**
1. Create two test user accounts (User A and User B)
2. **User A:** Log in and start a search
3. **User B:** Log in on a different browser/incognito window
4. Navigate both to home page

**Expected Results:**
- ✅ User A sees their active search
- ✅ User B sees normal search form (no active search)
- ✅ User B can start their own search
- ✅ Both searches complete independently
- ✅ Each user only sees their own jobs

**Verification:**
```sql
-- Check that RLS policies work
SELECT user_id, id, status, parameters
FROM search_runs 
WHERE status IN ('pending', 'running')
ORDER BY created_at DESC;

-- Should show separate runs for each user
```

---

### Test 6: Timer Resume Accuracy ✓

**Goal:** Verify that the timer shows accurate elapsed time when resuming

**Steps:**
1. Log in as test user
2. Initiate a search
3. Note the current timer value (e.g., 15 seconds)
4. Close the browser
5. Wait exactly 30 seconds (use a stopwatch)
6. Reopen the browser and log in
7. Note the new timer value

**Expected Results:**
- ✅ New timer value = Previous value + Wait time
- ✅ Example: If closed at 15s, waited 30s → shows ~45s
- ✅ Timer continues incrementing in real-time
- ✅ Accuracy within ±2 seconds (accounting for latency)

**Calculation:**
```javascript
// The hook calculates elapsed time as:
const startTime = new Date(created_at).getTime();
const now = Date.now();
const elapsedSeconds = Math.floor((now - startTime) / 1000);
```

---

### Test 7: Guest Users (No Change) ✓

**Goal:** Verify that guest users are not affected by cross-device features

**Steps:**
1. Log out completely (or use incognito mode)
2. Navigate to home page
3. Initiate a search as a guest
4. Close browser mid-search
5. Reopen and navigate to home page

**Expected Results:**
- ✅ Guest sees normal search form (no active search detection)
- ✅ Guest search uses localStorage (existing behavior)
- ✅ No database queries for search runs
- ✅ No errors in console
- ✅ Guest experience unchanged from before Release 4

---

### Test 8: Status Message Context ✓

**Goal:** Verify that different statuses show appropriate messages

**Steps:**
1. Initiate a search and observe messages at different stages

**Expected Messages:**

| Status | Condition | Expected Message |
|--------|-----------|------------------|
| `pending` | Search queued | "Your search is queued and will start shortly..." |
| `running` | Search in progress, single board | "Searching indeed..." (or linkedin, etc.) |
| `running` | Search in progress, all boards | "Searching all job boards..." |
| `success` | Search completed | Notification: "Found X jobs" → Redirect |
| `failed` | Search failed | Notification: Error message → Clear loading state |

---

## Edge Cases

### Edge Case 1: Search Completes While Browser is Closed
- Start search → Close browser → Search completes → Reopen
- **Expected:** Loading state briefly appears, then immediate redirect to results

### Edge Case 2: User Starts New Search While One is Active
- Search A running → User tries to start Search B
- **Expected:** Button disabled with loading state (existing behavior handles this)

### Edge Case 3: Supabase Realtime Disconnection
- Start search → Disconnect internet → Reconnect
- **Expected:** Hook should re-subscribe and catch up on status

### Edge Case 4: Very Fast Searches
- Search completes in < 5 seconds
- **Expected:** User might not see loading state, direct redirect to results

---

## Success Criteria

Release 4 is considered successful when:

- ✅ Users can close browser mid-search and resume on same device
- ✅ Users can monitor searches across different devices
- ✅ Timer shows accurate elapsed time when resuming
- ✅ Real-time updates work via Supabase subscriptions
- ✅ Failed searches show error messages correctly
- ✅ Users are automatically redirected when search completes
- ✅ Guest users continue working normally (no regression)
- ✅ No console errors during normal operation
- ✅ RLS policies prevent users from seeing each other's runs

---

## Troubleshooting

### Issue: Active search not detected on page load

**Check:**
```sql
SELECT * FROM search_runs 
WHERE user_id = '<user-id>' 
  AND status IN ('pending', 'running')
ORDER BY created_at DESC;
```

**Possible causes:**
- User not authenticated (`userId` is undefined)
- Search already completed (status is 'success' or 'failed')
- RLS policies blocking access

### Issue: Timer not resuming correctly

**Check:**
- Console logs for `[useSearchStatus] Found active run`
- Verify `created_at` timestamp is being passed correctly
- Check for timezone issues

**Debug:**
```javascript
// Add to console:
const createdAt = new Date(activeRun.created_at);
const now = new Date();
console.log('Created:', createdAt.toISOString());
console.log('Now:', now.toISOString());
console.log('Diff (seconds):', Math.floor((now - createdAt) / 1000));
```

### Issue: Real-time updates not working

**Check:**
1. Supabase Realtime is enabled for `search_runs` table
2. RLS policies allow real-time subscriptions
3. Console shows subscription logs
4. No network errors in DevTools → Network tab

**Fix:**
```sql
-- Enable realtime for search_runs table
ALTER TABLE search_runs REPLICA IDENTITY FULL;
```

### Issue: Cross-device not working

**Possible causes:**
- Different user accounts logged in
- Browser cache issues
- RLS policies too restrictive

**Verify same user:**
```sql
-- Check active sessions
SELECT user_id, COUNT(*) as active_runs
FROM search_runs
WHERE status IN ('pending', 'running')
GROUP BY user_id;
```

---

## Console Monitoring Commands

Use these SQL queries to monitor searches in real-time:

```sql
-- Watch search runs in real-time (refresh every 5 seconds)
SELECT 
  id,
  user_id,
  status,
  parameters->>'jobTitle' as job_title,
  parameters->>'site' as site,
  jobs_found,
  EXTRACT(EPOCH FROM (COALESCE(completed_at, NOW()) - created_at)) as elapsed_seconds,
  created_at,
  updated_at
FROM search_runs 
ORDER BY created_at DESC 
LIMIT 10;
```

```sql
-- Check for stuck searches (running > 5 minutes)
SELECT id, user_id, status, created_at, 
       EXTRACT(EPOCH FROM (NOW() - created_at)) as elapsed_seconds
FROM search_runs 
WHERE status IN ('pending', 'running')
  AND created_at < NOW() - INTERVAL '5 minutes';
```

---

## Next Steps After Testing

Once Release 4 testing is complete:

1. ✅ Document any issues found and fixes applied
2. ✅ Verify all test cases pass
3. ✅ Monitor production for 24-48 hours
4. ✅ Gather user feedback on cross-device experience
5. ✅ Proceed to Release 5 (Queue-Based Processing)

---

## Notes

- The `useSearchStatus` hook automatically handles cleanup (unsubscribe, stop timer) on unmount
- Search parameters are preserved from the database, so users see what they searched for
- The implementation reuses existing `LoadingInsight` and `Timer` components
- Real-time updates use Supabase's built-in Postgres CDC (Change Data Capture)
