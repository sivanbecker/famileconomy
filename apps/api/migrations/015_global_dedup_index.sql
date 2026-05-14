-- Migration: 015_global_dedup_index
-- Replaces the batch-scoped dedupe unique index with a global one.
-- Previously, uniqueness was enforced per (import_batch_id, dedupe_hash), which allowed
-- the same transaction to be inserted again from a different import batch.
-- The new index enforces uniqueness on dedupe_hash alone (globally per account, since
-- accountId is baked into the hash), excluding DUPLICATE and WITHIN_FILE_DUPLICATE rows
-- which are intentional duplicates with a duplicate_of FK pointing at the canonical row.

DROP INDEX IF EXISTS transactions_batch_dedupe_hash_unique;

CREATE UNIQUE INDEX transactions_global_dedupe_hash_unique
  ON transactions(dedupe_hash)
  WHERE status NOT IN ('DUPLICATE', 'WITHIN_FILE_DUPLICATE') AND dedupe_hash IS NOT NULL;
