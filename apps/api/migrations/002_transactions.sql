-- Migration: 002_transactions
-- Creates transactions and import_batches tables with RLS + pgcrypto encryption

-- ─── Import Batches ───────────────────────────────────────────────────────────

CREATE TABLE import_batches (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  UUID        NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  filename    TEXT        NOT NULL,
  row_count   INTEGER     NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;

-- RLS via join to accounts → users
CREATE POLICY import_batches_owner ON import_batches
  USING (
    account_id IN (
      SELECT id FROM accounts
      WHERE user_id = current_setting('app.current_user_id', true)::uuid
    )
  );

CREATE INDEX import_batches_account_id_idx ON import_batches(account_id);

-- ─── Transactions ─────────────────────────────────────────────────────────────
-- description and amount_shekels are encrypted at rest

CREATE TABLE transactions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      UUID        NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  import_batch_id UUID        REFERENCES import_batches(id),
  date            DATE        NOT NULL,
  description     BYTEA       NOT NULL,  -- pgcrypto encrypted
  amount_shekels  BYTEA       NOT NULL,  -- pgcrypto encrypted integer
  category        TEXT,
  dedupe_hash     TEXT        UNIQUE,
  installment_num INTEGER,
  installment_of  INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY transactions_owner ON transactions
  USING (
    account_id IN (
      SELECT id FROM accounts
      WHERE user_id = current_setting('app.current_user_id', true)::uuid
    )
  );

CREATE INDEX transactions_account_id_idx ON transactions(account_id);
CREATE INDEX transactions_date_idx ON transactions(date);
CREATE INDEX transactions_import_batch_id_idx ON transactions(import_batch_id);
