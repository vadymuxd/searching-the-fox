-- ============================================================================
-- Searching The Fox - Database Schema Migration
-- ============================================================================
-- This migration creates all tables, types, indexes, policies, and triggers
-- for the Searching The Fox job search platform
-- ============================================================================

-- ============================================================================
-- 1. CREATE CUSTOM TYPES
-- ============================================================================

-- Job status enum for user_jobs table
CREATE TYPE job_status AS ENUM (
  'new',
  'interested',
  'applied',
  'progressed',
  'rejected',
  'archived'
);

-- ============================================================================
-- 2. CREATE TABLES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Users Table (Custom user profiles linked to auth.users)
-- ----------------------------------------------------------------------------
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  preferences JSONB DEFAULT '{}' NOT NULL,
  metadata JSONB DEFAULT '{}' NOT NULL,
  keywords TEXT[] DEFAULT NULL
);

-- Index for faster email lookups
CREATE INDEX idx_users_email ON users(email);

COMMENT ON TABLE users IS 'Custom user profiles with preferences and metadata';
COMMENT ON COLUMN users.preferences IS 'User preferences (default search params, UI settings, etc.)';
COMMENT ON COLUMN users.metadata IS 'Additional user metadata (onboarding status, feature flags, etc.)';

-- ----------------------------------------------------------------------------
-- Jobs Table (Master deduplicated jobs table)
-- ----------------------------------------------------------------------------
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Core job information
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
  is_remote BOOLEAN DEFAULT FALSE NOT NULL,
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
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for performance
CREATE INDEX idx_jobs_job_url ON jobs(job_url);
CREATE INDEX idx_jobs_company ON jobs(company);
CREATE INDEX idx_jobs_title ON jobs(title);
CREATE INDEX idx_jobs_site ON jobs(site);
CREATE INDEX idx_jobs_date_posted ON jobs(date_posted DESC);
CREATE INDEX idx_jobs_location_city ON jobs(location_city);
CREATE INDEX idx_jobs_is_remote ON jobs(is_remote);
CREATE INDEX idx_jobs_created_at ON jobs(created_at DESC);

-- Compound index for deduplication checks
CREATE INDEX idx_jobs_dedup ON jobs(title, company, location_city);

COMMENT ON TABLE jobs IS 'Master jobs table with all unique jobs from all job boards (deduplicated)';
COMMENT ON COLUMN jobs.job_url IS 'Unique job URL - primary deduplication key';
COMMENT ON COLUMN jobs.site IS 'Job board site identifier (indeed, linkedin, etc.)';
COMMENT ON COLUMN jobs.source_site IS 'Human-readable source name (LinkedIn, Indeed, etc.)';

-- ----------------------------------------------------------------------------
-- User Jobs Table (User-Job relationship with status tracking)
-- ----------------------------------------------------------------------------
CREATE TABLE user_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  
  -- Status tracking
  status job_status DEFAULT 'new' NOT NULL,
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL, -- When user first saw this job
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL, -- When status last changed
  
  -- Prevent duplicate entries
  UNIQUE(user_id, job_id)
);

-- Indexes for fast queries
CREATE INDEX idx_user_jobs_user_id ON user_jobs(user_id);
CREATE INDEX idx_user_jobs_job_id ON user_jobs(job_id);
CREATE INDEX idx_user_jobs_status ON user_jobs(status);
CREATE INDEX idx_user_jobs_user_status ON user_jobs(user_id, status);
CREATE INDEX idx_user_jobs_created_at ON user_jobs(created_at DESC);
CREATE INDEX idx_user_jobs_updated_at ON user_jobs(updated_at DESC);

COMMENT ON TABLE user_jobs IS 'Junction table linking users to jobs with status tracking';
COMMENT ON COLUMN user_jobs.status IS 'Job application status: new, interested, applied, progressed, rejected, archived';
COMMENT ON COLUMN user_jobs.notes IS 'User notes about this job';

-- ============================================================================
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Enable RLS on all tables
-- ----------------------------------------------------------------------------
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_jobs ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- Users Table Policies
-- ----------------------------------------------------------------------------

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (auth.uid() = id);

-- System can insert on signup (handled by trigger)
CREATE POLICY "System can insert users"
  ON users FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ----------------------------------------------------------------------------
-- Jobs Table Policies
-- ----------------------------------------------------------------------------

-- All authenticated users can read jobs
CREATE POLICY "Authenticated users can view jobs"
  ON jobs FOR SELECT
  USING (auth.role() = 'authenticated');

-- Service role can manage jobs (for backend operations)
CREATE POLICY "Service role can manage jobs"
  ON jobs FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Authenticated users can insert jobs (for when they perform searches)
CREATE POLICY "Authenticated users can insert jobs"
  ON jobs FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- ----------------------------------------------------------------------------
-- User Jobs Table Policies
-- ----------------------------------------------------------------------------

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

-- ============================================================================
-- 4. FUNCTIONS & TRIGGERS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Function: Auto-update updated_at timestamp
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_updated_at_column() IS 'Automatically updates updated_at timestamp on row update';

-- ----------------------------------------------------------------------------
-- Triggers: Apply updated_at to all tables
-- ----------------------------------------------------------------------------
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_jobs_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_jobs_updated_at
  BEFORE UPDATE ON user_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- Function: Auto-create user profile on signup
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, created_at, updated_at)
  VALUES (NEW.id, NEW.email, NOW(), NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.handle_new_user() IS 'Automatically creates user profile when new auth user is created';

-- ----------------------------------------------------------------------------
-- Trigger: Create user profile on auth signup
-- ----------------------------------------------------------------------------
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 5. HELPER FUNCTIONS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Function: Get user jobs by status
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_user_jobs_by_status(
  p_user_id UUID,
  p_status job_status DEFAULT NULL
)
RETURNS TABLE (
  job_id UUID,
  title TEXT,
  company TEXT,
  company_logo_url TEXT,
  location TEXT,
  is_remote BOOLEAN,
  job_type TEXT,
  salary_min NUMERIC,
  salary_max NUMERIC,
  salary_currency TEXT,
  job_url TEXT,
  date_posted TIMESTAMPTZ,
  site TEXT,
  source_site TEXT,
  status job_status,
  notes TEXT,
  user_first_saw TIMESTAMPTZ,
  user_last_updated TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    j.id,
    j.title,
    j.company,
    j.company_logo_url,
    j.location,
    j.is_remote,
    j.job_type,
    j.salary_min,
    j.salary_max,
    j.salary_currency,
    j.job_url,
    j.date_posted,
    j.site,
    j.source_site,
    uj.status,
    uj.notes,
    uj.created_at,
    uj.updated_at
  FROM jobs j
  JOIN user_jobs uj ON j.id = uj.job_id
  WHERE uj.user_id = p_user_id
    AND (p_status IS NULL OR uj.status = p_status)
  ORDER BY uj.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_user_jobs_by_status IS 'Retrieves all jobs for a user, optionally filtered by status';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Verification queries (comment out when running migration)
-- SELECT 'Users table created' WHERE EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users');
-- SELECT 'Jobs table created' WHERE EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'jobs');
-- SELECT 'User_jobs table created' WHERE EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_jobs');
-- SELECT 'RLS enabled on users' WHERE (SELECT relrowsecurity FROM pg_class WHERE relname = 'users');
-- SELECT 'RLS enabled on jobs' WHERE (SELECT relrowsecurity FROM pg_class WHERE relname = 'jobs');
-- SELECT 'RLS enabled on user_jobs' WHERE (SELECT relrowsecurity FROM pg_class WHERE relname = 'user_jobs');
