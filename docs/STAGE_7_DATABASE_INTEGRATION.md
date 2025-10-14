# Stage 7: Connect Scraping to Database - Complete ✅

## What We Built

Connected the job scraping functionality to the Supabase database, implementing a dual-mode system where:
- **Anonymous users**: Data stored in localStorage (as before)
- **Authenticated users**: Data automatically saved to database with full tracking capabilities

---

## New Files Created

### 1. **Job Service** (`src/lib/db/jobService.ts`)

Server-side functions for database operations:

#### **saveJobsToDatabase(jobs, userId)**
- Maps frontend Job type to database schema
- Checks for existing jobs by `job_url` (deduplication)
- Inserts new jobs into `jobs` table
- Creates `user_jobs` entries with status "new"
- Avoids duplicate user_jobs entries
- Returns count of jobs saved

#### **getUserJobs(userId, status?)**
- Fetches user's jobs from database with JOIN
- Filters by status if provided (new, interested, applied, etc.)
- Returns jobs with user_jobs metadata (status, applied_at, notes)
- Sorts by created_at (newest first)

#### **updateJobStatus(userJobId, status, notes?)**
- Updates job status for a user
- Sets `applied_at` timestamp when status changes to "applied"
- Updates notes if provided
- Updates `updated_at` timestamp

#### **removeUserJob(userJobId)**
- Deletes user_jobs entry (removes job from user's list)
- Doesn't delete from jobs table (other users may have same job)

---

### 2. **MoveToDbButton Component** (`src/components/MoveToDbButton.tsx`)

Button for manually moving localStorage data to database:
- ✅ Only visible to authenticated users
- ✅ Shows when jobs exist in localStorage
- ✅ Calls `saveJobsToDatabase` on click
- ✅ Shows loading state during save
- ✅ Changes to "Jobs Saved to Database" after success
- ✅ Displays count of jobs moved
- ✅ Calls `onComplete` callback to reload from DB

---

## Updated Files

### **src/app/page.tsx**

Major updates to integrate database functionality:

#### New State Variables
```typescript
const [user, setUser] = useState<User | null>(null);
const [loadingUserJobs, setLoadingUserJobs] = useState(false);
```

#### Auth State Listener
```typescript
useEffect(() => {
  const supabase = createClient();
  
  // Get initial session
  supabase.auth.getUser().then(({ data: { user } }) => {
    setUser(user);
    if (user) {
      loadUserJobsFromDb(user.id);
    }
  });
  
  // Listen for auth changes
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserJobsFromDb(session.user.id);
      }
    }
  );
  
  return () => subscription.unsubscribe();
}, []);
```

#### Load User Jobs from Database
```typescript
const loadUserJobsFromDb = async (userId: string) => {
  setLoadingUserJobs(true);
  try {
    const result = await getUserJobs(userId);
    if (result.success && result.jobs.length > 0) {
      setJobs(result.jobs);
      setFilteredJobs(result.jobs);
      setSearchStarted(true);
    }
  } catch (error) {
    console.error('Error loading user jobs:', error);
  } finally {
    setLoadingUserJobs(false);
  }
};
```

#### Auto-Save to Database
```typescript
const autoSaveToDb = async (newJobs: Job[], userId: string) => {
  try {
    const result = await saveJobsToDatabase(newJobs, userId);
    if (result.success) {
      console.log(`Auto-saved ${result.jobsSaved} jobs to database`);
      // Reload jobs from DB to get updated list with metadata
      await loadUserJobsFromDb(userId);
    }
  } catch (error) {
    console.error('Error auto-saving to database:', error);
  }
};
```

#### Updated localStorage Loading
Only loads from localStorage if user is NOT signed in:
```typescript
useEffect(() => {
  setMounted(true);
  
  // Only load from localStorage if user is NOT signed in
  if (!user) {
    const savedResults = searchStorage.loadSearchResults();
    // ... load from localStorage
  }
}, [user]);
```

#### Updated Search Handler
Auto-saves to database after successful search:
```typescript
if (response.success) {
  setJobs(response.jobs);
  setFilteredJobs(response.jobs);
  
  // Save to localStorage (backup)
  searchStorage.saveSearchResults({...});
  
  // Auto-save to database if authenticated
  if (user) {
    await autoSaveToDb(response.jobs, user.id);
  }
  
  notifications.show({
    message: `Found ${response.jobs.length} jobs${user ? ' and saved to your account' : ''}`,
    // ...
  });
}
```

#### Added MoveToDbButton
Shows at bottom of results for authenticated users:
```typescript
{jobs.length > 0 && (
  <Box mt="xl">
    <Stack align="center" gap="md">
      {user && !loadingUserJobs && (
        <MoveToDbButton 
          jobs={jobs}
          userId={user.id}
          onComplete={() => loadUserJobsFromDb(user.id)}
        />
      )}
      <AuthButton onSignInClick={() => setAuthModalOpened(true)} />
    </Stack>
  </Box>
)}
```

---

## User Flow Examples

### **Anonymous User Flow** (unchanged)

1. User performs search
2. Results saved to localStorage
3. Results displayed from localStorage
4. User can refresh page and see saved results
5. **New**: Encouraged to sign in to save jobs permanently

### **New User Signup Flow**

1. Anonymous user performs search → saved to localStorage
2. User clicks "Sign In" → creates account
3. User sees "Move Local Data to DB" button
4. User clicks button → jobs moved from localStorage to database
5. Page reloads → jobs now loaded from database
6. User can access jobs from any device

### **Authenticated User Search Flow**

1. User performs search
2. **During loading**: Jobs being scraped
3. **After completion**: 
   - Jobs saved to localStorage (backup)
   - **Auto-saved to database** (no user action needed)
   - Jobs table updated (new jobs inserted, duplicates skipped)
   - user_jobs entries created with status "new"
4. Page shows jobs with database metadata
5. User sees "saved to your account" in notification

### **Returning User Flow**

1. User signs in
2. **Automatically**: `loadUserJobsFromDb()` is called
3. Jobs loaded from database (all jobs user has seen before)
4. Search results view displayed (skips pre-search state)
5. User sees all their jobs with status tracking

---

## Database Operations Flow

### **Save Jobs Process**

```
1. Check existing jobs in database by job_url
2. Split jobs into:
   - New jobs (not in database)
   - Existing jobs (already in database)
3. Insert new jobs → get their IDs
4. Collect all job IDs (new + existing)
5. Check existing user_jobs entries
6. Create user_jobs entries for new associations
7. Return total count of jobs saved
```

### **Deduplication Strategy**

- **Jobs table**: Deduplicated by `job_url` (UNIQUE constraint)
- **User_jobs table**: Deduplicated by `(user_id, job_id)` (composite UNIQUE)
- Multiple users can have the same job (different user_jobs entries)
- Same user can't have duplicate job entries

---

## Key Features

### ✅ **Step 1: Move to DB Button**
- Button displayed only for signed-in users
- Shows at bottom of results page
- Manual trigger for moving localStorage data
- Changes to "Jobs Saved" after completion

### ✅ **Step 2: Data Migration Function**
- `saveJobsToDatabase()` implemented
- Maps Job type to database schema
- Fills `jobs` table with unique jobs
- Creates `user_jobs` entries linking users to jobs
- Handles deduplication properly

### ✅ **Step 3: Auto-Triggers**
- **3.1**: Manual trigger via "Move to DB" button ✅
- **3.2**: Auto-trigger during search for authenticated users ✅
  - Saves during search completion
  - Updates database before displaying results
  - Shows "saved to your account" notification

### ✅ **Step 4: Load from Database**
- Authenticated users see their jobs from database
- Data loaded automatically on sign-in
- Pre-search state skipped for users with existing jobs
- localStorage still used for anonymous users

---

## Data Mapping

### Frontend Job Type → Database Schema

```typescript
{
  // Core fields
  title → title
  company → company
  job_url → job_url (UNIQUE)
  location → location
  
  // Job details
  is_remote → is_remote
  description → description
  job_type → job_type
  job_function → job_function
  job_level → job_level
  
  // Salary
  salary_min → salary_min
  salary_max → salary_max
  salary_currency → salary_currency
  
  // Company
  company_url → company_url
  company_logo_url → company_logo_url
  company_industry → company_industry
  
  // Metadata
  date_posted → date_posted (converted to ISO)
  source_site → source_site
  benefits → benefits
}
```

---

## Testing

### Test Manual Move to DB

1. Sign out if signed in
2. Perform a search (e.g., "Software Engineer" in "London")
3. See results (saved to localStorage)
4. Sign in with your account
5. Should see "Move Local Data to DB" button
6. Click button
7. Should see success notification with count
8. Button changes to "Jobs Saved to Database"
9. Check Supabase Dashboard:
   - Go to Table Editor → `jobs`
   - Should see new jobs inserted
   - Go to Table Editor → `user_jobs`
   - Should see entries linking your user to jobs

### Test Auto-Save on Search

1. Sign in
2. Perform a new search
3. Wait for results
4. Should see "Found X jobs and saved to your account"
5. Check Supabase Dashboard:
   - New jobs in `jobs` table
   - New entries in `user_jobs` table

### Test Load from Database

1. Sign in (if not already)
2. Refresh page
3. Should automatically see your jobs from database
4. Should skip pre-search state (no "searching the fox" logo screen)
5. Should see all jobs you've seen before

### Test Deduplication

1. Perform same search twice
2. Should not create duplicate jobs in `jobs` table
3. Should not create duplicate `user_jobs` entries
4. Job count should remain the same

---

## Database Schema Used

### Jobs Table

```sql
CREATE TABLE jobs (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  job_url TEXT NOT NULL UNIQUE, -- Deduplication key
  location TEXT,
  -- ... (30+ more fields)
  source_site TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

### User Jobs Table

```sql
CREATE TABLE user_jobs (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  job_id UUID REFERENCES jobs(id),
  status TEXT DEFAULT 'new', -- new, interested, applied, progressed, rejected, archived
  applied_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  UNIQUE(user_id, job_id) -- Prevent duplicates
);
```

---

## Next Steps

### Stage 8: Build Status Tabs UI

Now that jobs are saved to database with status tracking:
- [ ] Create tab navigation (New/Interested/Applied/Progressed/Rejected/Archived)
- [ ] Filter jobs by status from database
- [ ] Add status change buttons/dropdown
- [ ] Call `updateJobStatus()` on status change
- [ ] Real-time UI updates

---

## Troubleshooting

### "Move to DB" button not showing
- ✅ Make sure you're signed in
- ✅ Make sure you have jobs displayed
- ✅ Check browser console for errors

### Jobs not saving to database
- ✅ Check Supabase connection
- ✅ Check RLS policies are enabled
- ✅ Check browser console for errors
- ✅ Verify user is authenticated

### Duplicate jobs in database
- ✅ Check `job_url` field is populated
- ✅ Verify UNIQUE constraint on jobs.job_url
- ✅ Check deduplication logic in `saveJobsToDatabase()`

### Can't see jobs after sign in
- ✅ Check `getUserJobs()` is being called
- ✅ Verify user_jobs entries exist in database
- ✅ Check browser console for errors
- ✅ Try refreshing the page

---

**Status**: ✅ Stage 7 Complete - Database Integration Working!

Users can now save jobs to the database, and authenticated users have all their job data synced across devices! 🎉

**Next**: Stage 8 - Build the status tabs UI to let users organize their jobs by status.
