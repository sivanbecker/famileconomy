-- Migration: 008_batch_scoped_dedup
-- Changes duplicate detection from global to batch-scoped.
-- The unique index on dedupe_hash is replaced with a composite index on (import_batch_id, dedupe_hash).
-- This allows the same transaction to appear in different imports (different months) without conflict.

-- Drop the global partial unique index
DROP INDEX IF EXISTS transactions_dedupe_hash_unique;

-- Create a new partial unique index scoped to (import_batch_id, dedupe_hash)
-- Only enforces uniqueness for non-DUPLICATE rows within the same batch
CREATE UNIQUE INDEX transactions_batch_dedupe_hash_unique
  ON transactions(import_batch_id, dedupe_hash)
  WHERE status NOT IN ('DUPLICATE') AND import_batch_id IS NOT NULL;
