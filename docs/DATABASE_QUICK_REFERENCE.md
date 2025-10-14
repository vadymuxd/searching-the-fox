# Database Quick Reference

## Tables Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         auth.users                              │
│                    (Supabase managed)                           │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 │ ON INSERT → trigger creates profile
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                           users                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ id (UUID) ← FK to auth.users                             │  │
│  │ email                                                    │  │
│  │ preferences (JSONB)                                      │  │
│  │ metadata (JSONB)                                         │  │
│  │ created_at, updated_at                                   │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 │ 1 user : N jobs
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                        user_jobs                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ id (UUID)                                                │  │
│  │ user_id (UUID) → users.id                                │  │
│  │ job_id (UUID) → jobs.id                                  │  │
│  │ status (ENUM) ───────────────────────────┐               │  │
│  │ notes                                    │               │  │
│  │ created_at, updated_at                   │               │  │
│  └──────────────────────────────────────────┼───────────────┘  │
└─────────────────────────────────────────────┼───────────────────┘
                 ▲                            │
                 │                            │
                 │ N users : N jobs           │ Status:
                 │                            │ • new
                 │                            │ • interested
┌────────────────┴────────────────────────────┼─• applied
│                           jobs              │ • progressed
│  ┌──────────────────────────────────────────┼─• rejected
│  │ id (UUID)                                │ • archived
│  │ title, company                           │
│  │ job_url (UNIQUE) ← dedup key             │
│  │ location, is_remote                      │
│  │ description, job_type                    │
│  │ salary_min, salary_max                   │
│  │ date_posted                              │
│  │ site, source_site                        │
│  │ ...30+ fields from JobSpy                │
│  │ created_at, updated_at                   │
│  └──────────────────────────────────────────┘
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Relationships

```sql
users.id ──────────────────────┐
  │                            │
  │ 1:N                        │ 1:N
  │                            │
  ▼                            ▼
user_jobs.user_id          user_jobs.job_id
  ▲                            ▲
  │ N:1                        │ N:1
  │                            │
  └────────────────────────────┴──── jobs.id
```

---

## Common Queries

### Get User's Jobs by Status

```sql
-- All jobs
SELECT * FROM get_user_jobs_by_status(:user_id, NULL);

-- Specific status
SELECT * FROM get_user_jobs_by_status(:user_id, 'interested');
```

### Insert Job with Deduplication

```sql
INSERT INTO jobs (title, company, job_url, site, ...)
VALUES (...)
ON CONFLICT (job_url) DO NOTHING
RETURNING id;
```

### Link User to Job

```sql
INSERT INTO user_jobs (user_id, job_id, status)
VALUES (:user_id, :job_id, 'new')
ON CONFLICT (user_id, job_id) DO NOTHING;
```

### Update Job Status

```sql
UPDATE user_jobs
SET status = :new_status, notes = :notes
WHERE user_id = :user_id AND job_id = :job_id;
```

### Get Jobs by Status (Manual)

```sql
SELECT j.*, uj.status, uj.notes
FROM jobs j
JOIN user_jobs uj ON j.id = uj.job_id
WHERE uj.user_id = :user_id
  AND uj.status = 'interested'
ORDER BY uj.created_at DESC;
```

---

## RLS Security Model

| Table | Policy | Who Can Access |
|-------|--------|----------------|
| `users` | SELECT | Own profile only |
| `users` | UPDATE | Own profile only |
| `users` | INSERT | System (trigger) |
| `jobs` | SELECT | All authenticated users |
| `jobs` | INSERT | Authenticated users |
| `jobs` | ALL | Service role (backend) |
| `user_jobs` | SELECT | Own relationships only |
| `user_jobs` | INSERT | Own relationships only |
| `user_jobs` | UPDATE | Own relationships only |
| `user_jobs` | DELETE | Own relationships only |

---

## Indexes

**users:**
- `idx_users_email` on `email`

**jobs:**
- `idx_jobs_job_url` on `job_url`
- `idx_jobs_company` on `company`
- `idx_jobs_title` on `title`
- `idx_jobs_site` on `site`
- `idx_jobs_date_posted` on `date_posted DESC`
- `idx_jobs_location_city` on `location_city`
- `idx_jobs_is_remote` on `is_remote`
- `idx_jobs_created_at` on `created_at DESC`
- `idx_jobs_dedup` on `(title, company, location_city)`

**user_jobs:**
- `idx_user_jobs_user_id` on `user_id`
- `idx_user_jobs_job_id` on `job_id`
- `idx_user_jobs_status` on `status`
- `idx_user_jobs_user_status` on `(user_id, status)`
- `idx_user_jobs_created_at` on `created_at DESC`
- `idx_user_jobs_updated_at` on `updated_at DESC`

---

## Status Workflow

```
┌─────┐
│ new │ ← Initial state when user sees job
└──┬──┘
   │
   ▼
┌────────────┐
│ interested │ ← User marks as interesting
└──────┬─────┘
       │
       ├──────────────┐
       │              │
       ▼              ▼
┌─────────┐    ┌──────────┐
│ applied │    │ rejected │
└────┬────┘    └──────────┘
     │
     ▼
┌────────────┐
│ progressed │ ← Interview/next steps
└──────┬─────┘
       │
       ├──────────────┐
       │              │
       ▼              ▼
┌──────────┐    ┌──────────┐
│ archived │    │ rejected │
└──────────┘    └──────────┘
```

Any status can move to `archived` at any time.

---

## Quick Stats Queries

```sql
-- Total jobs in system
SELECT COUNT(*) FROM jobs;

-- Jobs per site
SELECT site, COUNT(*) FROM jobs GROUP BY site;

-- User's job count by status
SELECT status, COUNT(*) 
FROM user_jobs 
WHERE user_id = :user_id 
GROUP BY status;

-- Recent jobs (last 24 hours)
SELECT COUNT(*) 
FROM jobs 
WHERE created_at > NOW() - INTERVAL '24 hours';

-- Remote jobs percentage
SELECT 
  (COUNT(*) FILTER (WHERE is_remote = true) * 100.0 / COUNT(*))::numeric(5,2) as remote_percentage
FROM jobs;
```

---

## Migration File

Location: `supabase/migrations/001_initial_schema.sql`

Run in Supabase Dashboard → SQL Editor

---

## Auto-Generated Fields

These fields update automatically:

- `created_at` - Set on INSERT (default NOW())
- `updated_at` - Set on INSERT and UPDATE (trigger)
- `users.id` - Created on auth signup (trigger)
- `users.email` - Synced from auth.users (trigger)
