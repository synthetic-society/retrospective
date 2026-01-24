-- Add admin_token column to sessions table
ALTER TABLE sessions ADD COLUMN admin_token TEXT;
