# Database Schema Design

## Overview
This document defines the database schema for Searching The Fox, integrating Supabase PostgreSQL with our job scraping service.

---

## Tables

### 1. `users` (Custom Users Table)

Stores user preferences and metadata. Linked to Supabase `auth.users`.

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  preferences JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}'
);

-- Index for faster lookups
CREATE INDEX idx_users_email ON users(email);
```

**Fields:**
- `id` - UUID, foreign key to auth.users.id
- `email` - User's email (synced from auth.users)
- `created_at` - Account creation timestamp
- `updated_at` - Last update timestamp
- `preferences` - JSONB for user preferences:
  ```json
  {
    "defaultLocation": "London",
    "defaultSite": "all",
    "defaultHoursOld": "24",
    "sortPreference": "posted-recent",
    "displayMode": "table"
  }
  ```
- `metadata` - JSONB for additional metadata:
  ```json
  {
    "onboardingCompleted": true,
    "lastSearchDate": "2024-10-14T10:00:00Z"
  }
  ```

---

### 2. `jobs` (Master Jobs Table - Deduplicated)

Stores all unique jobs scraped from all job boards. Deduplicated across users.

```sql
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Core job information (from JobSpy)
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  company_url TEXT,
  company_logo_url TEXT,
  job_url TEXT NOT NULL UNIQUE, -- Deduplication key
  location TEXT,
  location_country TEXT,
  location_city TEXT,
  location_state TEXT,
  
  -- Job details
  is_remote BOOLEAN DEFAULT FALSE,
  description TEXT,
  job_type TEXT, -- fulltime, parttime, internship, contract
  job_function TEXT,
  job_level TEXT, -- LinkedIn specific
  
  -- Salary information
  salary_interval TEXT, -- yearly, monthly, weekly, daily, hourly
  salary_min NUMERIC,
  salary_max NUMERIC,
  salary_currency TEXT DEFAULT 'USD',
  salary_source TEXT, -- direct_data, description
  
  -- Company information
  company_industry TEXT, -- LinkedIn & Indeed
  company_country TEXT, -- Indeed specific
  company_addresses TEXT, -- Indeed specific
  company_employees_label TEXT, -- Indeed specific
  company_revenue_label TEXT, -- Indeed specific
  company_description TEXT, -- Indeed specific
  company_rating NUMERIC, -- Naukri specific
  company_reviews_count INTEGER, -- Naukri specific
  
  -- Additional fields
  date_posted TIMESTAMPTZ,
  emails TEXT[], -- Array of email addresses from job posting
  skills TEXT[], -- Naukri specific
  experience_range TEXT, -- Naukri specific
  vacancy_count INTEGER, -- Naukri specific
  work_from_home_type TEXT, -- Naukri specific
  
  -- Source information
  site TEXT NOT NULL, -- indeed, linkedin, glassdoor, zip_recruiter, google
  source_site TEXT, -- Friendly name (e.g., "LinkedIn", "Indeed")
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_jobs_job_url ON jobs(job_url);
CREATE INDEX idx_jobs_company ON jobs(company);
CREATE INDEX idx_jobs_title ON jobs(title);
CREATE INDEX idx_jobs_site ON jobs(site);
CREATE INDEX idx_jobs_date_posted ON jobs(date_posted DESC);
CREATE INDEX idx_jobs_location_city ON jobs(location_city);
CREATE INDEX idx_jobs_is_remote ON jobs(is_remote);

-- Compound index for deduplication checks
CREATE INDEX idx_jobs_dedup ON jobs(title, company, location_city);
```

**Deduplication Strategy:**
- Primary: `job_url` (UNIQUE constraint)
- Fallback: Hash of `title + company + location` for jobs without URLs

---

### 3. `user_jobs` (User-Job Relationship & Status Tracking)

Junction table linking users to jobs with status tracking.

```sql
CREATE TYPE job_status AS ENUM (
  'new',
  'interested',
  'applied',
  'progressed',
  'rejected',
  'archived'
);

CREATE TABLE user_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  
  -- Status tracking
  status job_status DEFAULT 'new',
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(), -- When user first saw this job
  updated_at TIMESTAMPTZ DEFAULT NOW(), -- When status last changed
  
  -- Prevent duplicate entries
  UNIQUE(user_id, job_id)
);

-- Indexes for fast queries
CREATE INDEX idx_user_jobs_user_id ON user_jobs(user_id);
CREATE INDEX idx_user_jobs_job_id ON user_jobs(job_id);
CREATE INDEX idx_user_jobs_status ON user_jobs(status);
CREATE INDEX idx_user_jobs_user_status ON user_jobs(user_id, status);
CREATE INDEX idx_user_jobs_created_at ON user_jobs(created_at DESC);
```

**Status Workflow:**
```
new → interested → applied → progressed
                           → rejected
                           → archived
```

---

## Mapping JobSpy API Response to Database

### JobSpy DataFrame Columns → `jobs` Table

| JobSpy Field | DB Field | Type | Notes |
|--------------|----------|------|-------|
| `title` | `title` | TEXT | ✅ Required |
| `company` | `company` | TEXT | ✅ Required |
| `company_url` | `company_url` | TEXT | Optional |
| `job_url` | `job_url` | TEXT | ✅ Unique key |
| `location` | `location` | TEXT | Full location string |
| `location.country` | `location_country` | TEXT | Parsed |
| `location.city` | `location_city` | TEXT | Parsed |
| `location.state` | `location_state` | TEXT | Parsed |
| `is_remote` | `is_remote` | BOOLEAN | Default FALSE |
| `description` | `description` | TEXT | Can be markdown/html |
| `job_type` | `job_type` | TEXT | fulltime, parttime, etc. |
| `job_function` | `job_function` | TEXT | Optional |
| `job_level` | `job_level` | TEXT | LinkedIn only |
| `interval` | `salary_interval` | TEXT | yearly, monthly, etc. |
| `min_amount` | `salary_min` | NUMERIC | - |
| `max_amount` | `salary_max` | NUMERIC | - |
| `currency` | `salary_currency` | TEXT | Default 'USD' |
| `salary_source` | `salary_source` | TEXT | direct_data or description |
| `company_industry` | `company_industry` | TEXT | LinkedIn & Indeed |
| `company_country` | `company_country` | TEXT | Indeed |
| `company_addresses` | `company_addresses` | TEXT | Indeed |
| `company_employees_label` | `company_employees_label` | TEXT | Indeed |
| `company_revenue_label` | `company_revenue_label` | TEXT | Indeed |
| `company_description` | `company_description` | TEXT | Indeed |
| `company_logo` | `company_logo_url` | TEXT | Indeed (enhanced by our service) |
| `company_rating` | `company_rating` | NUMERIC | Naukri |
| `company_reviews_count` | `company_reviews_count` | INTEGER | Naukri |
| `date_posted` | `date_posted` | TIMESTAMPTZ | - |
| `emails` | `emails` | TEXT[] | Array |
| `skills` | `skills` | TEXT[] | Naukri |
| `experience_range` | `experience_range` | TEXT | Naukri |
| `vacancy_count` | `vacancy_count` | INTEGER | Naukri |
| `work_from_home_type` | `work_from_home_type` | TEXT | Naukri |
| `site` | `site` | TEXT | indeed, linkedin, etc. |
| N/A | `source_site` | TEXT | Generated: "LinkedIn", "Indeed" |

---

## Row Level Security (RLS) Policies

### `users` Table

```sql
-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (auth.uid() = id);

-- System can insert on signup
CREATE POLICY "System can insert users"
  ON users FOR INSERT
  WITH CHECK (auth.uid() = id);
```

### `jobs` Table

```sql
-- Enable RLS
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read jobs
CREATE POLICY "Authenticated users can view jobs"
  ON jobs FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only service role can insert/update jobs (via backend)
CREATE POLICY "Service role can manage jobs"
  ON jobs FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');
```

### `user_jobs` Table

```sql
-- Enable RLS
ALTER TABLE user_jobs ENABLE ROW LEVEL SECURITY;

-- Users can view their own job relationships
CREATE POLICY "Users can view own job relationships"
  ON user_jobs FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own job relationships
CREATE POLICY "Users can create own job relationships"
  ON user_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own job relationships
CREATE POLICY "Users can update own job relationships"
  ON user_jobs FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own job relationships
CREATE POLICY "Users can delete own job relationships"
  ON user_jobs FOR DELETE
  USING (auth.uid() = user_id);
```

---

## Database Functions & Triggers

### Auto-update `updated_at` timestamp

```sql
-- Function to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for users table
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for jobs table
CREATE TRIGGER update_jobs_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for user_jobs table
CREATE TRIGGER update_user_jobs_updated_at
  BEFORE UPDATE ON user_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### Auto-create user profile on signup

```sql
-- Function to create user profile after auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, created_at, updated_at)
  VALUES (NEW.id, NEW.email, NOW(), NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

---

## Key Design Decisions

1. **Job Deduplication**: Use `job_url` as unique constraint. Jobs from different sources with same URL are the same job.

2. **User-Job Many-to-Many**: Multiple users can see the same job, each with their own status.

3. **Status Enum**: Fixed status types prevent data inconsistency.

4. **JSONB for Flexibility**: User preferences and metadata use JSONB for schema-less flexibility.

5. **Timestamps**: Track creation and update times for audit trails.

6. **Array Types**: Use PostgreSQL arrays for emails and skills.

7. **RLS Policies**: Ensure data isolation between users at database level.

---

## Migration from localStorage

When a user signs up:

1. **Parse localStorage data** (jobs array)
2. **For each job**:
   - Check if job exists in `jobs` table (by `job_url`)
   - If not exists: INSERT into `jobs`
   - Get `job_id`
   - INSERT into `user_jobs` with `status = 'new'`
3. **Clear localStorage** after successful migration

---

## Example Queries

### Get all jobs for a user by status

```sql
SELECT 
  j.*,
  uj.status,
  uj.notes,
  uj.created_at as user_first_saw,
  uj.updated_at as user_last_updated
FROM jobs j
JOIN user_jobs uj ON j.id = uj.job_id
WHERE uj.user_id = '<user_uuid>'
  AND uj.status = 'interested'
ORDER BY uj.created_at DESC;
```

### Update job status

```sql
UPDATE user_jobs
SET status = 'applied', notes = 'Applied via LinkedIn'
WHERE user_id = '<user_uuid>' AND job_id = '<job_uuid>';
```

### Insert job with deduplication

```sql
INSERT INTO jobs (title, company, job_url, site, ...)
VALUES (...)
ON CONFLICT (job_url) DO NOTHING
RETURNING id;
```

---

## Next Steps

- [ ] Create Supabase project
- [ ] Run SQL migrations to create tables
- [ ] Set up RLS policies
- [ ] Create database functions and triggers
- [ ] Test with sample data
- [ ] Integrate with Next.js frontend
