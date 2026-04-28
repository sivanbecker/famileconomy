-- Migration: 006_soft_dedup_ddl
-- Adds duplicate_of FK and partial unique index on dedupe_hash.
-- Runs after 005_soft_dedup so that the DUPLICATE enum value is committed
-- and available for use in the partial index predicate.

-- ─── Add duplicate_of column ──────────────────────────────────────────────────

ALTER TABLE transactions
  ADD COLUMN duplicate_of UUID REFERENCES transactions(id) ON DELETE SET NULL;

CREATE INDEX transactions_duplicate_of_idx ON transactions(duplicate_of)
  WHERE duplicate_of IS NOT NULL;

-- ─── Replace UNIQUE constraint with partial unique index ──────────────────────
-- Uniqueness is only enforced for non-duplicate rows, allowing duplicate rows
-- to share the same dedupe_hash as the original transaction.

ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_dedupe_hash_key;

CREATE UNIQUE INDEX transactions_dedupe_hash_unique
  ON transactions(dedupe_hash)
  WHERE status NOT IN ('DUPLICATE');
