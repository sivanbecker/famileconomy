-- Migration: 004_audit_log
-- Creates append-only audit_log table and revokes UPDATE/DELETE from app role

CREATE TABLE audit_log (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id),
  action     TEXT        NOT NULL,
  table_name TEXT        NOT NULL,
  record_id  TEXT        NOT NULL,
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Users may only read their own audit log entries; no writes via app role
CREATE POLICY audit_log_owner ON audit_log
  FOR SELECT
  USING (user_id = current_setting('app.current_user_id', true)::uuid);

CREATE INDEX audit_log_user_id_idx ON audit_log(user_id);
CREATE INDEX audit_log_table_record_idx ON audit_log(table_name, record_id);
CREATE INDEX audit_log_created_at_idx ON audit_log(created_at DESC);

-- ─── Revoke mutation rights from the application role ─────────────────────────
-- The app role (famileconomy_app) may INSERT but never UPDATE or DELETE audit rows.
-- Run as superuser at deploy time; if the role doesn't exist yet, this is a no-op.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'famileconomy_app') THEN
    REVOKE UPDATE, DELETE ON audit_log FROM famileconomy_app;
  END IF;
END;
$$;
