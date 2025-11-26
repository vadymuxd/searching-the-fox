-- Add email_notifications_enabled column to users table
-- This column stores whether a user has opted in to receive email notifications

ALTER TABLE users 
ADD COLUMN email_notifications_enabled BOOLEAN DEFAULT FALSE;

-- Create index for faster queries when finding users who opted in
CREATE INDEX idx_users_email_notifications_enabled 
ON users(email_notifications_enabled) 
WHERE email_notifications_enabled = TRUE;

-- Add comment to document the column
COMMENT ON COLUMN users.email_notifications_enabled IS 'Whether user has opted in to receive email notifications about new jobs';
