-- Migration: 011_within_file_dup_index
-- Extends the batch-scoped dedupe unique index to also exclude
-- WITHIN_FILE_DUPLICATE rows, which share a dedupe_hash with their
-- canonical row inside the same batch.

DROP INDEX IF EXISTS transactions_batch_dedupe_hash_unique;

CREATE UNIQUE INDEX transactions_batch_dedupe_hash_unique
  ON transactions(import_batch_id, dedupe_hash)
  WHERE status NOT IN ('DUPLICATE', 'WITHIN_FILE_DUPLICATE') AND import_batch_id IS NOT NULL;
