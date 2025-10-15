-- ============================================================================
-- Add Keywords Column Migration
-- ============================================================================
-- This migration adds the keywords column to the existing users table
-- Run this if you already have the users table created from 001_initial_schema.sql
-- ============================================================================

-- Add keywords column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS keywords TEXT[] DEFAULT NULL;

-- Add comment for the new column
COMMENT ON COLUMN users.keywords IS 'Array of saved filter keywords for the user (used for frontend job filters)';

-- Verification query (optional - uncomment to test)
-- SELECT column_name, data_type, is_nullable, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'users' AND column_name = 'keywords';