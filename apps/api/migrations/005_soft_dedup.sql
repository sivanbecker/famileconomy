-- Migration: 005_soft_dedup
-- Adds soft duplicate detection to transactions:
--   - New enum values: DUPLICATE (system-flagged), REVIEWED_OK (user-confirmed real charge)
--   - New column: duplicate_of — FK to the original transaction
--   - Replaces the UNIQUE constraint on dedupe_hash with a partial unique index
--     so that duplicate rows can share the same hash while originals remain unique

-- ─── Extend transaction_status enum ──────────────────────────────────────────

ALTER TYPE transaction_status ADD VALUE IF NOT EXISTS 'DUPLICATE';
ALTER TYPE transaction_status ADD VALUE IF NOT EXISTS 'REVIEWED_OK';

-- ─── Add duplicate_of column ──────────────────────────────────────────────────

ALTER TABLE transactions
  ADD COLUMN duplicate_of UUID REFERENCES transactions(id) ON DELETE SET NULL;

CREATE INDEX transactions_duplicate_of_idx ON transactions(duplicate_of)
  WHERE duplicate_of IS NOT NULL;

-- ─── Replace UNIQUE constraint with partial unique index ──────────────────────
-- Only enforce uniqueness for non-duplicate rows. Duplicate rows are allowed
-- to share the same dedupe_hash as the original.

ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_dedupe_hash_key;

CREATE UNIQUE INDEX transactions_dedupe_hash_unique
  ON transactions(dedupe_hash)
  WHERE status NOT IN ('DUPLICATE');
