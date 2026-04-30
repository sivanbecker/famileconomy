-- Migration: 008_google_oauth_token
-- Adds encrypted Google OAuth refresh token to the users table.
-- Token is stored as BYTEA (encrypted via pgcrypto at rest).

ALTER TABLE users
  ADD COLUMN google_refresh_token BYTEA;
