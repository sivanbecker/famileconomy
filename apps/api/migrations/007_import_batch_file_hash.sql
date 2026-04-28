-- Migration: 007_import_batch_file_hash
-- Adds file_hash (SHA-256 of file content) to import_batches for batch-level
-- dedup. Re-uploading the exact same file is rejected before any rows are
-- processed, preventing the entire file from landing as duplicates.

ALTER TABLE import_batches
  ADD COLUMN file_hash TEXT;

CREATE UNIQUE INDEX import_batches_account_file_hash_unique
  ON import_batches(account_id, file_hash)
  WHERE file_hash IS NOT NULL;
