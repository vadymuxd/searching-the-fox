-- Migration: Add search_runs table for tracking search execution
-- Purpose: Enable persistent tracking of job searches for cross-device visibility and automation
-- Created: 2025-11-12

-- Create ENUM type for search source
CREATE TYPE search_source AS ENUM ('manual', 'cron');

-- Create ENUM type for search run status
CREATE TYPE search_run_status AS ENUM ('pending', 'running', 'success', 'failed');

-- Create search_runs table
CREATE TABLE IF NOT EXISTS public.search_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source search_source NOT NULL DEFAULT 'manual',
    client_context JSONB,
    parameters JSONB NOT NULL,
    status search_run_status NOT NULL DEFAULT 'pending',
    error_message TEXT,
    jobs_found INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

-- Create indexes for common queries
CREATE INDEX idx_search_runs_user_id ON public.search_runs(user_id);
CREATE INDEX idx_search_runs_status ON public.search_runs(status);
CREATE INDEX idx_search_runs_created_at ON public.search_runs(created_at DESC);
CREATE INDEX idx_search_runs_user_status ON public.search_runs(user_id, status);

-- Add Row Level Security (RLS) policies
ALTER TABLE public.search_runs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view only their own search runs
CREATE POLICY "Users can view own search runs"
    ON public.search_runs
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Policy: Users can insert search runs with their own user_id
CREATE POLICY "Users can insert own search runs"
    ON public.search_runs
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update only their own search runs
CREATE POLICY "Users can update own search runs"
    ON public.search_runs
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy: Service role can do everything (for worker access)
CREATE POLICY "Service role has full access"
    ON public.search_runs
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_search_runs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to call the function
CREATE TRIGGER set_search_runs_updated_at
    BEFORE UPDATE ON public.search_runs
    FOR EACH ROW
    EXECUTE FUNCTION update_search_runs_updated_at();

-- Add comments for documentation
COMMENT ON TABLE public.search_runs IS 'Tracks job search execution for cross-device visibility and automation';
COMMENT ON COLUMN public.search_runs.id IS 'Unique identifier for the search run';
COMMENT ON COLUMN public.search_runs.user_id IS 'Reference to the user who owns this search';
COMMENT ON COLUMN public.search_runs.source IS 'How the search was triggered: manual (user-initiated) or cron (automated)';
COMMENT ON COLUMN public.search_runs.client_context IS 'Optional metadata about the client (device, browser, etc.)';
COMMENT ON COLUMN public.search_runs.parameters IS 'Search parameters: jobTitle, location, site, hours_old, etc.';
COMMENT ON COLUMN public.search_runs.status IS 'Current status: pending, running, success, or failed';
COMMENT ON COLUMN public.search_runs.error_message IS 'Error details if status is failed';
COMMENT ON COLUMN public.search_runs.jobs_found IS 'Number of jobs found in successful searches';
COMMENT ON COLUMN public.search_runs.created_at IS 'When the search run was created';
COMMENT ON COLUMN public.search_runs.updated_at IS 'When the search run was last updated';
COMMENT ON COLUMN public.search_runs.started_at IS 'When the search actually started processing';
COMMENT ON COLUMN public.search_runs.completed_at IS 'When the search finished (success or failed)';
