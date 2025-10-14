# Stage 5: Database Tables Setup

## Overview

This guide walks you through creating all database tables, policies, and functions in Supabase.

---

## Option 1: Run Migration via Supabase Dashboard (Recommended)

### Step 1: Open SQL Editor

1. Go to your Supabase project: https://supabase.com/dashboard/project/nwgusbtqxsakmukpniqo
2. Click on **SQL Editor** in the left sidebar
3. Click **New Query**

### Step 2: Copy and Run Migration

1. Open the migration file: `supabase/migrations/001_initial_schema.sql`
2. Copy the entire contents
3. Paste into the SQL Editor
4. Click **Run** (or press Ctrl/Cmd + Enter)

### Step 3: Verify Tables Created

After running the migration, you should see:

✅ **Tables Created:**
- `users` - User profiles with preferences
- `jobs` - Master jobs table (deduplicated)
- `user_jobs` - User-job relationships with status

✅ **Types Created:**
- `job_status` - ENUM for status values

✅ **Indexes Created:**
- 15+ indexes for performance

✅ **RLS Policies:**
- 9 policies for data security

✅ **Functions & Triggers:**
- `update_updated_at_column()` - Auto-update timestamps
- `handle_new_user()` - Auto-create user profiles
- `get_user_jobs_by_status()` - Helper query function

### Step 4: Check Tables in Table Editor

1. Click **Table Editor** in the left sidebar
2. You should see:
   - `users`
   - `jobs`
   - `user_jobs`

Click on each table to see the columns and structure.

---

## Option 2: Run Migration via Supabase CLI (Advanced)

### Prerequisites

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref nwgusbtqxsakmukpniqo
```

### Run Migration

```bash
cd /path/to/searching-the-fox
supabase db push
```

---

## What Gets Created

### 1. **users** Table

Custom user profiles linked to `auth.users`:

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Foreign key to auth.users |
| `email` | TEXT | User email (synced) |
| `preferences` | JSONB | UI preferences, default search params |
| `metadata` | JSONB | Onboarding status, feature flags |
| `created_at` | TIMESTAMPTZ | Account creation |
| `updated_at` | TIMESTAMPTZ | Last update |

**Example preferences:**
```json
{
  "defaultLocation": "London",
  "defaultSite": "all",
  "defaultHoursOld": "24",
  "sortPreference": "posted-recent"
}
```

### 2. **jobs** Table

Master deduplicated jobs table:

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `title` | TEXT | Job title |
| `company` | TEXT | Company name |
| `job_url` | TEXT | Unique job URL (dedup key) |
| `location` | TEXT | Full location string |
| `is_remote` | BOOLEAN | Remote job flag |
| `description` | TEXT | Job description |
| `job_type` | TEXT | fulltime, parttime, etc. |
| `salary_min/max` | NUMERIC | Salary range |
| `date_posted` | TIMESTAMPTZ | When job was posted |
| `site` | TEXT | Job board identifier |
| ...30+ more fields | | See schema for full list |

### 3. **user_jobs** Table

User-job relationships with status tracking:

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | Foreign key to users |
| `job_id` | UUID | Foreign key to jobs |
| `status` | job_status | new/interested/applied/progressed/rejected/archived |
| `notes` | TEXT | User notes |
| `created_at` | TIMESTAMPTZ | When user first saw job |
| `updated_at` | TIMESTAMPTZ | When status last changed |

**Status Flow:**
```
new → interested → applied → progressed
                           → rejected
                           → archived
```

---

## Row Level Security (RLS)

All tables have RLS enabled with the following policies:

### users Table
- ✅ Users can view their own profile
- ✅ Users can update their own profile
- ✅ System can insert on signup

### jobs Table
- ✅ All authenticated users can view jobs
- ✅ Service role can manage jobs
- ✅ Authenticated users can insert jobs

### user_jobs Table
- ✅ Users can view their own job relationships
- ✅ Users can create their own job relationships
- ✅ Users can update their own job relationships
- ✅ Users can delete their own job relationships

---

## Automatic Triggers

### 1. Auto-Update Timestamps

All tables automatically update `updated_at` on any UPDATE operation.

### 2. Auto-Create User Profile

When a new user signs up via Supabase Auth, a profile is automatically created in the `users` table:

```sql
-- Trigger runs on: INSERT into auth.users
-- Creates:
INSERT INTO users (id, email, created_at, updated_at)
VALUES (NEW.id, NEW.email, NOW(), NOW());
```

---

## Helper Functions

### get_user_jobs_by_status()

Retrieve all jobs for a user, optionally filtered by status:

```sql
-- Get all jobs for a user
SELECT * FROM get_user_jobs_by_status('user-uuid-here', NULL);

-- Get only "interested" jobs
SELECT * FROM get_user_jobs_by_status('user-uuid-here', 'interested');
```

Returns joined data from `jobs` and `user_jobs` tables with all relevant information.

---

## Verification

### Check Tables Exist

Run this in SQL Editor:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
  AND table_name IN ('users', 'jobs', 'user_jobs');
```

Should return 3 rows.

### Check RLS Enabled

```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('users', 'jobs', 'user_jobs');
```

`rowsecurity` should be `true` for all tables.

### Check Policies

```sql
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public';
```

Should return 9 policies.

### Check Triggers

```sql
SELECT trigger_name, event_object_table 
FROM information_schema.triggers 
WHERE trigger_schema = 'public';
```

Should show triggers for all three tables plus the auth trigger.

---

## Testing the Setup

### 1. Test User Creation (Manual)

```sql
-- This will be automatic on signup, but you can test manually
INSERT INTO auth.users (id, email) 
VALUES (gen_random_uuid(), 'test@example.com');

-- Check if user profile was auto-created
SELECT * FROM users WHERE email = 'test@example.com';
```

### 2. Test Job Insertion

```sql
-- Insert a test job
INSERT INTO jobs (
  title, 
  company, 
  job_url, 
  site, 
  location
) VALUES (
  'Software Engineer',
  'Test Company',
  'https://example.com/job/123',
  'linkedin',
  'London, UK'
) RETURNING *;
```

### 3. Test User-Job Relationship

```sql
-- Link a user to a job with status
INSERT INTO user_jobs (user_id, job_id, status)
VALUES (
  'user-uuid-here',
  'job-uuid-here',
  'interested'
) RETURNING *;
```

### 4. Test Status Update

```sql
-- Update job status
UPDATE user_jobs
SET status = 'applied', notes = 'Applied via LinkedIn'
WHERE user_id = 'user-uuid-here' AND job_id = 'job-uuid-here';

-- Check updated_at was auto-updated
SELECT status, notes, updated_at FROM user_jobs 
WHERE user_id = 'user-uuid-here' AND job_id = 'job-uuid-here';
```

---

## Troubleshooting

### Error: "relation does not exist"
- Make sure you ran the migration in the correct database
- Check you're connected to the right project

### Error: "permission denied"
- Check RLS policies are correctly set up
- Verify you're authenticated when testing

### Error: "duplicate key value violates unique constraint"
- For `job_url`: Job already exists (this is expected for deduplication)
- For `user_id, job_id` in user_jobs: User already has this job

### Trigger Not Working
- Check trigger exists: `\dft` in psql or query `information_schema.triggers`
- Verify function exists and has correct permissions

---

## Next Steps

After successful migration:

- [ ] ✅ Tables created
- [ ] ✅ RLS policies configured
- [ ] ✅ Triggers working
- [ ] ✅ Helper functions available
- [ ] → Proceed to Stage 4: Authentication Setup
- [ ] → Proceed to Stage 6: Build Auth Frontend
- [ ] → Proceed to Stage 7: Connect Scraping to Database

---

## Rollback (if needed)

If you need to start over:

```sql
-- Drop tables (in reverse order due to foreign keys)
DROP TABLE IF EXISTS user_jobs CASCADE;
DROP TABLE IF EXISTS jobs CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop type
DROP TYPE IF EXISTS job_status CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS get_user_jobs_by_status(UUID, job_status) CASCADE;

-- Drop trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
```

Then re-run the migration.

---

**Ready?** Run the migration and let me know if you encounter any issues! 🚀
