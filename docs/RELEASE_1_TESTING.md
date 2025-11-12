# Release 1 Testing Guide - Database Foundation

This guide provides step-by-step instructions for testing Release 1: Database Foundation.

## Goal
Create the database infrastructure to persist search run metadata without changing any user-facing behavior.

## Prerequisites
- Supabase project access
- Access to Supabase SQL Editor
- Test user account(s) for RLS testing

## Testing Steps

### Step 1: Run the Migration

1. Open your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Open the migration file: `docs/003_add_search_runs_table.sql`
4. Copy the entire SQL content
5. Paste into Supabase SQL Editor
6. Click **Run** to execute the migration

**Expected Result:** ✅ Migration executes successfully with no errors

---

### Step 2: Verify Table Creation

1. In Supabase, navigate to **Table Editor**
2. Look for the `search_runs` table

**Expected Result:** ✅ Table exists with the following structure:

| Column | Type | Default | Nullable |
|--------|------|---------|----------|
| id | uuid | gen_random_uuid() | No |
| user_id | uuid | - | No |
| source | search_source | 'manual' | No |
| client_context | jsonb | - | Yes |
| parameters | jsonb | - | No |
| status | search_run_status | 'pending' | No |
| error_message | text | - | Yes |
| jobs_found | integer | - | Yes |
| created_at | timestamptz | now() | No |
| updated_at | timestamptz | now() | No |
| started_at | timestamptz | - | Yes |
| completed_at | timestamptz | - | Yes |

---

### Step 3: Verify ENUM Types

Run this query in SQL Editor:

```sql
SELECT 
    t.typname as enum_name,
    e.enumlabel as enum_value
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE t.typname IN ('search_source', 'search_run_status')
ORDER BY t.typname, e.enumsortorder;
```

**Expected Result:** ✅ Shows:

| enum_name | enum_value |
|-----------|------------|
| search_run_status | pending |
| search_run_status | running |
| search_run_status | success |
| search_run_status | failed |
| search_source | manual |
| search_source | cron |

---

### Step 4: Verify Indexes

Run this query:

```sql
SELECT
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'search_runs'
ORDER BY indexname;
```

**Expected Result:** ✅ Shows at least these indexes:
- `idx_search_runs_user_id`
- `idx_search_runs_status`
- `idx_search_runs_created_at`
- `idx_search_runs_user_status`
- Primary key index on `id`

---

### Step 5: Test RLS Policy - User Can Insert Own Rows

1. Get a test user's UUID from `auth.users` table:

```sql
SELECT id, email FROM auth.users LIMIT 1;
```

2. Switch to that user's context (use Supabase client with user auth token, or simulate):

```sql
-- Insert a test search run as authenticated user
INSERT INTO search_runs (user_id, parameters, status)
VALUES (
  auth.uid(), -- This should be the authenticated user's ID
  '{"jobTitle": "Test Engineer", "location": "London", "site": ["indeed"], "hours_old": 24}'::jsonb,
  'pending'
)
RETURNING *;
```

**Expected Result:** ✅ Row inserted successfully

---

### Step 6: Test RLS Policy - User Can Select Own Rows

```sql
-- As authenticated user, select their own search runs
SELECT * FROM search_runs WHERE user_id = auth.uid();
```

**Expected Result:** ✅ Returns the row(s) belonging to the authenticated user

---

### Step 7: Test RLS Policy - User Cannot Select Other Users' Rows

1. Create two test users if you don't have them
2. As User A, insert a search run
3. As User B, try to select User A's search runs:

```sql
-- This should return empty (User B can't see User A's runs)
SELECT * FROM search_runs WHERE user_id = '<user_a_uuid>';
```

**Expected Result:** ✅ Returns empty result set (no access to other users' data)

---

### Step 8: Test RLS Policy - Service Role Has Full Access

Using the service role key (from Supabase settings):

```sql
-- Service role can select all rows
SELECT * FROM search_runs;

-- Service role can insert for any user
INSERT INTO search_runs (user_id, parameters, status)
VALUES (
  '<any_user_uuid>',
  '{"jobTitle": "Backend Developer", "location": "Berlin", "site": ["linkedin"], "hours_old": 72}'::jsonb,
  'pending'
)
RETURNING *;

-- Service role can update any row
UPDATE search_runs
SET status = 'running', started_at = NOW()
WHERE id = '<any_search_run_id>'
RETURNING *;
```

**Expected Result:** ✅ All operations succeed (service role bypasses RLS)

---

### Step 9: Test Updated_at Trigger

1. Insert a test row:

```sql
INSERT INTO search_runs (user_id, parameters, status)
VALUES (
  auth.uid(),
  '{"jobTitle": "DevOps", "location": "Manchester"}'::jsonb,
  'pending'
)
RETURNING id, created_at, updated_at;
```

2. Note the `updated_at` timestamp

3. Wait 2 seconds, then update the row:

```sql
UPDATE search_runs
SET status = 'running'
WHERE id = '<id_from_above>'
RETURNING created_at, updated_at;
```

**Expected Result:** ✅ `updated_at` is automatically updated to current timestamp (newer than `created_at`)

---

### Step 10: Test JSONB Parameters Field

Insert a search run with complex parameters:

```sql
INSERT INTO search_runs (user_id, parameters, status)
VALUES (
  auth.uid(),
  '{
    "jobTitle": "Full Stack Developer",
    "location": "London",
    "site": ["indeed", "linkedin", "glassdoor"],
    "hours_old": 24,
    "results_wanted": 20,
    "country_indeed": "UK"
  }'::jsonb,
  'pending'
)
RETURNING *;
```

Query with JSONB operators:

```sql
-- Find search runs for "Full Stack Developer"
SELECT * FROM search_runs
WHERE parameters->>'jobTitle' = 'Full Stack Developer';

-- Find search runs with hours_old = 24
SELECT * FROM search_runs
WHERE (parameters->>'hours_old')::int = 24;
```

**Expected Result:** ✅ Rows inserted and queried correctly using JSONB

---

### Step 11: Test All Status Transitions

```sql
-- Insert pending run
INSERT INTO search_runs (user_id, parameters, status)
VALUES (auth.uid(), '{"jobTitle": "Test"}'::jsonb, 'pending')
RETURNING id;

-- Update to running
UPDATE search_runs SET status = 'running', started_at = NOW()
WHERE id = '<id>' RETURNING *;

-- Update to success
UPDATE search_runs 
SET status = 'success', completed_at = NOW(), jobs_found = 42
WHERE id = '<id>' RETURNING *;

-- Test failed status
INSERT INTO search_runs (user_id, parameters, status, error_message)
VALUES (
  auth.uid(),
  '{"jobTitle": "Test Fail"}'::jsonb,
  'failed',
  'Connection timeout'
)
RETURNING *;
```

**Expected Result:** ✅ All status transitions work correctly

---

### Step 12: Verify Foreign Key Constraint

Try to insert a search run with non-existent user_id:

```sql
INSERT INTO search_runs (user_id, parameters, status)
VALUES (
  '00000000-0000-0000-0000-000000000000'::uuid,
  '{"jobTitle": "Test"}'::jsonb,
  'pending'
);
```

**Expected Result:** ✅ Error: Foreign key violation (user doesn't exist)

---

### Step 13: Test Cascade Delete

1. Insert a test user and search runs for them
2. Delete the user from `auth.users`
3. Check that their search runs are also deleted:

```sql
-- Search runs should be auto-deleted due to ON DELETE CASCADE
SELECT * FROM search_runs WHERE user_id = '<deleted_user_uuid>';
```

**Expected Result:** ✅ Returns empty (cascade delete worked)

---

## Success Criteria Checklist

- ✅ Table exists with correct schema
- ✅ ENUM types created correctly
- ✅ All indexes present
- ✅ RLS policies work:
  - ✅ Users can SELECT own rows
  - ✅ Users can INSERT own rows
  - ✅ Users can UPDATE own rows
  - ✅ Users CANNOT see other users' rows
  - ✅ Service role has full access
- ✅ `updated_at` trigger works
- ✅ JSONB parameters field works
- ✅ All status values accepted
- ✅ Foreign key constraint enforced
- ✅ Cascade delete works
- ✅ No errors in Supabase logs

---

## Troubleshooting

### Issue: ENUM type already exists
**Solution:** Drop and recreate:
```sql
DROP TYPE IF EXISTS search_source CASCADE;
DROP TYPE IF EXISTS search_run_status CASCADE;
-- Then re-run the migration
```

### Issue: RLS policy blocks insert
**Solution:** Ensure you're using authenticated user context, not anonymous access

### Issue: Cannot update updated_at
**Solution:** Verify trigger exists:
```sql
SELECT * FROM pg_trigger WHERE tgname = 'set_search_runs_updated_at';
```

---

## Next Steps

After completing all tests successfully:
1. ✅ Update `DATABASE_SCHEMA.md` documentation (already done)
2. ✅ Commit migration file to repository
3. 🔜 Proceed to **Release 2**: Backend - Create Search Run Records
