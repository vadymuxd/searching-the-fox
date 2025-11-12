# Scalable Worker Plan

This document outlines a robust and scalable plan to implement an automatic job search worker for the "Searching The Fox" application.

## 1. The Goal

The primary goal is to improve user experience by proactively fetching fresh job postings for users. Instead of a user waiting up to 5 minutes for a search to complete, the application will feel instantaneous because the jobs will already be in the database.

This will be achieved by a scheduled worker that runs several times a day, performing job searches based on each user's last known search criteria.

## 2. Current Limitations

A purely serverless approach remains infeasible because of familiar constraints, and we must also solve for new user experience goals (cross-device visibility into search progress).

- **Vercel timeouts:** Serverless functions on the free/pro tiers have strict runtime ceilings (~5 minutes). Sequentially scraping many users risks hitting this limit.
- **Fragility today:** A single long-lived request on Render can still fail midway; we need better isolation, retries, and idempotency.
- **Manual-search blind spot:** When a user kicks off a search from any client, the status lives only in local state. Closing the app or switching devices hides all progress.
- **Lack of run tracking:** There is no persistent record tying the user, search parameters, triggering device, and current status together. Without it, meaningful UX updates are impossible.

## 3. Updated Architecture Overview

We keep Render as the heavy-lift worker, but introduce a persistent search queue so every search (manual or automated) follows the same lifecycle. This gives us a single source of truth for status, enables cross-device UX, and allows gradual rollout.

![Architecture Diagram](https://i.imgur.com/eY2h4vW.png)

### Core Concepts

- **`search_runs` table (Supabase):** Stores one row per search attempt. Columns include `id`, `user_id`, `source` (`manual`, `cron`), `client_context` (optional metadata, e.g. device), `parameters`, `status` (`pending`, `running`, `success`, `failed`), timestamps, and an error field. This table powers UX and acts as the job queue.
- **Unified enqueue flow:** Any time a search is triggered (button click or scheduled refresh) the Next.js app records a new `search_runs` entry and returns the identifier to the client.
- **Render workers:** Poll or receive batches of pending runs, mark them `running`, execute the scrape, persist jobs, then mark the run `success` or `failed` with context.
- **Frontend feedback loop:** Clients subscribe (Supabase realtime) or poll a lightweight API to reflect shared status. A user can close or swap devices and still see the exact progress of their latest search.
- **Cron as a producer:** Vercel cron becomes just another enqueuer. It inserts a run per user instead of calling Render directly, keeping the trigger cheap and reliable.

### Component Roles

1. **Next.js application**
   - Collects search parameters from either the user or scheduled jobs.
   - Creates `search_runs` entries and responds immediately with the ongoing status ID.
   - Exposes authenticated APIs to list and inspect run status for the user.

2. **Supabase database**
   - Persists `search_runs` rows and enforces ownership via RLS (users see only their runs; Render operates with service key).
   - Optionally publishes realtime updates when rows change.

3. **Render `jobspy-service`**
   - Polls for pending runs in manageable batches (configurable batch size) to avoid timeouts.
   - Marks runs `running` before work, updates `status` and `error` on completion, and writes job results as today.
   - Runs under the service role key so it can process any user.

4. **Vercel Cron**
   - Inserts scheduled runs (`source = 'cron'`) at desired intervals.
   - Remains ignorant of worker internals, improving reliability and simplifying secrets management.

### Security Considerations

- Store `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, and any queue polling credentials in dedicated environments with rotation procedures.
- Rate-limit public trigger endpoints and log all run creation events for auditing.
- Consider IP allow-lists or signed requests for Render webhooks if we expose push triggers later.

## 4. Execution Roadmap (Incremental Releases)

Each release has a clear goal, user value, and testing plan. Releases are kept small to minimise risk and ensure each step can be tested independently.

---

### Release 1 – Database Foundation: Track Search Runs

**Goal:** Create the database infrastructure to persist search run metadata without changing any user-facing behavior.

**User Value:** None yet (foundational work). This enables future releases.

**Implementation:**
- Create `search_runs` table in Supabase with columns:
  - `id` (UUID, primary key)
  - `user_id` (UUID, foreign key to users)
  - `source` (ENUM: `manual`, `cron`)
  - `client_context` (JSONB, nullable - stores device/browser info)
  - `parameters` (JSONB - stores search parameters: jobTitle, location, site, etc.)
  - `status` (ENUM: `pending`, `running`, `success`, `failed`)
  - `error_message` (TEXT, nullable)
  - `jobs_found` (INTEGER, nullable)
  - `created_at` (TIMESTAMPTZ)
  - `updated_at` (TIMESTAMPTZ)
  - `started_at` (TIMESTAMPTZ, nullable)
  - `completed_at` (TIMESTAMPTZ, nullable)
- Add RLS policies:
  - Users can SELECT only their own runs
  - Users can INSERT runs with their own user_id
  - Service role can do everything
- Create migration SQL file and apply to Supabase

**Testing Plan:**
- Run migration in Supabase SQL editor
- Verify table exists with correct schema
- Test RLS policies:
  - Authenticated user can insert a test row with their user_id
  - Authenticated user can SELECT their own rows
  - Authenticated user CANNOT select another user's rows
- Document the schema in `docs/DATABASE_SCHEMA.md`

**Success Criteria:** Table exists, policies work, no errors in Supabase logs.

---

### Release 2 – Backend: Create Search Run Records

**Goal:** When a user initiates a search, create a `search_runs` record in the database while maintaining existing search functionality.

**User Value:** None visible yet, but search history is now being tracked in the database.

**Implementation:**
- Create `src/lib/db/searchRunService.ts` with functions:
  - `createSearchRun(userId, parameters, source, clientContext?)` - creates a new run with status `pending`
  - `updateSearchRunStatus(runId, status, error?, jobsFound?)` - updates run status
  - `getSearchRun(runId)` - retrieves a single run
  - `getUserSearchRuns(userId, limit?)` - gets recent runs for a user
- Update the existing manual search flow in Next.js:
  - Before calling Render API, create a `search_runs` record
  - Pass the `run_id` to Render in the request payload
  - After Render returns results, update the run status to `success` with jobs count
  - On error, update run status to `failed` with error message
- Render API updates:
  - Accept optional `run_id` parameter
  - When scraping starts, update run status to `running` (if run_id provided)
  - When scraping completes, update run status to `success` or `failed`

**Testing Plan:**
- Initiate a manual search as a logged-in user
- Check Supabase `search_runs` table:
  - Verify a new row was created with status `pending`
  - After search completes, verify status updated to `success` and `jobs_found` is set
  - Verify `started_at` and `completed_at` timestamps are populated
- Test error case:
  - Trigger a search that will fail (invalid parameters)
  - Verify status updates to `failed` with error message
- Confirm existing search functionality still works (jobs appear in UI as before)

**Success Criteria:** Every manual search creates and updates a `search_runs` record; existing UX unchanged.

---

### Release 3 – Frontend: Cross-Device Search Status Visibility

**Goal:** Allow users to see their ongoing search status even after closing the app or switching devices.

**User Value:** **High impact UX improvement** - Users can initiate a search on their phone, close the app, and check progress later on their laptop. No more wondering if the search is still running.

**Implementation:**
- Create `src/lib/db/searchRunService.ts` client-side functions:
  - `getActiveSearchRun(userId)` - gets the most recent `pending` or `running` search
  - `subscribeToSearchRun(runId, callback)` - uses Supabase realtime to listen for status changes
- Update `SearchForm` component:
  - On mount, check if there's an active search run for the user
  - If found, immediately show loading state with existing `LoadingInsight` and `Timer` components
  - Display the search parameters from the stored run
- Create `SearchStatusManager` component/hook:
  - Manages search run lifecycle
  - Shows `LoadingInsight` and `Timer` when status is `pending` or `running`
  - Subscribes to realtime updates for the active run
  - Redirects to results when status changes to `success`
  - Shows error notification when status changes to `failed`
- Update home page (`page.tsx`):
  - On load, check for active search runs
  - If active run exists, automatically navigate to loading state
  - Resume timer based on `created_at` timestamp

**Testing Plan:**
- **Test 1: Same device continuation**
  - Initiate search on desktop
  - Close the browser tab mid-search
  - Reopen the app
  - Verify: Loading screen appears with `LoadingInsight` and `Timer` showing elapsed time
  - Wait for search to complete
  - Verify: Results appear automatically
  
- **Test 2: Cross-device continuation**
  - Initiate search on mobile device
  - Close mobile app
  - Open app on desktop
  - Verify: Loading screen appears with search status
  - Verify: Timer shows correct elapsed time
  - Verify: Results appear when search completes
  
- **Test 3: Multiple searches**
  - Initiate search A (long search)
  - While A is running, try to initiate search B
  - Verify: UI handles this gracefully (either blocks new search or queues it)
  
- **Test 4: Failed search recovery**
  - Initiate a search that will fail
  - Close app during search
  - Reopen app
  - Verify: Error message appears when status updates to `failed`
  - Verify: User can initiate a new search

**Success Criteria:** Users can seamlessly continue monitoring searches across devices; `LoadingInsight` and `Timer` components work correctly with persisted state.

---

### Release 4 – Render Worker: Queue-Based Processing

**Goal:** Decouple search execution from the HTTP request/response cycle by having Render poll the queue.

**User Value:** More reliable searches - if Render worker crashes, searches can be retried automatically.

**Implementation:**
- Update Render `jobspy-service`:
  - Add `supabase-py` dependency
  - Create `/worker/poll-queue` endpoint
  - Poll `search_runs` for `pending` runs (batch of 5)
  - Mark each as `running`, execute scrape, update status
  - Add retry logic (3 attempts) for failed runs
  - Add idempotency checks (skip if already running/completed)
- Update Next.js manual search flow:
  - Create run with status `pending`
  - Return run_id to client immediately (don't wait for Render)
  - Client polls run status or subscribes via realtime
- Add Render worker as a background job (not triggered by HTTP):
  - Configure Render to run the polling endpoint every 30 seconds
  - Or use Render background worker (if available on plan)

**Testing Plan:**
- Initiate search from UI
- Verify search run created with `pending` status
- Verify UI immediately shows loading state
- Monitor Render logs for queue polling
- Verify run status changes to `running` then `success`
- Test with multiple concurrent searches
- Test retry logic by simulating failures
- Verify searches complete even if Next.js restarts

**Success Criteria:** Searches complete reliably via queue polling; no long HTTP requests; retries work.

---

### Release 5 – Scheduled Automation via Vercel Cron

**Goal:** Automatically refresh job searches for all users at scheduled times.

**User Value:** **Core feature delivered** - Users wake up to fresh jobs without having to manually search.

**Implementation:**
- Create `/api/cron/schedule-user-searches` endpoint:
  - Fetches all users with their last search criteria from `search_runs` table (most recent successful search per user)
  - Creates one `search_runs` row per user with source=`cron`
  - **Important:** Override the `hours_old` parameter to use 3 hours (for "Last 3 hours" Posted Within filter) regardless of user's last search setting
  - Returns immediately (doesn't wait for processing)
- Configure `vercel.json` with cron schedules:
  - Runs at 8:00, 10:00, 14:00, 16:00, 16:45, 22:00 UK time
  - Timezone: `Europe/London`
- Protect endpoint with `CRON_SECRET`
- Add rate limiting to prevent abuse
- Update Render worker to process both `manual` and `cron` runs
- **Note:** The JobSpy API on Render supports `hours_old` parameter - verified in `main.py` that it accepts this parameter and converts it to a date filter

**Testing Plan:**
- Manually trigger the cron endpoint (with secret)
- Verify `search_runs` rows created for all users with correct parameters
- **Verify `hours_old` is set to 3 (not the user's last search value)**
- Verify Render worker processes them correctly
- Verify users see new jobs appear (only from last 3 hours)
- Test at actual scheduled time (deploy and wait)
- Monitor for 24 hours to ensure all cron jobs fire
- Check users receive fresh jobs at scheduled times

**Success Criteria:** Automated searches run on schedule; all users receive fresh jobs from the last 3 hours; no failures.

## 5. Benefits of the Updated Plan

- **Immediate UX win:** Users gain cross-device visibility in Release 3 (after foundational work in releases 1-2).
- **Scalable and resilient:** Releases 4-5 introduce queue-driven processing, better error handling, and flexibility to scale worker capacity.
- **Incremental risk:** Each release is small and testable end-to-end with real users, reducing chances of breaking existing Render functionality.
- **Aligned triggers:** Manual searches, cron jobs, and any future integrations share the same infrastructure, simplifying maintenance.
- **Reuses existing components:** The plan leverages existing `LoadingInsight` and `Timer` components, minimising new UI development.
- **Clear testing path:** Each release has explicit testing scenarios, making it easier to validate and catch issues early.
- **Smart scheduling:** Automated searches always use "Last 3 hours" filter to fetch only recent jobs, optimizing performance and relevance.

## 6. Notes on Existing Components

The plan leverages these existing UI components for the loading experience:

- **`LoadingInsight` component** (`src/components/LoadingInsight.tsx`): Displays random job search insights during loading to keep users engaged.
- **`Timer` component** (`src/components/Timer.tsx`): Shows elapsed time during search execution.

These components are already integrated into the current search flow and will be reused for cross-device search status visibility. In Release 3, we'll adapt them to work with persisted search run data from the database instead of only local state.

This phased approach keeps the existing Render service stable while progressively layering in the shared queue, richer UX, and automated scheduling.
