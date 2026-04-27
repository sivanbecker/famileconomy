-- Migration: 002_transactions
-- Creates transactions and import_batches tables with RLS + pgcrypto encryption
--
-- Schema informed by real Max and Cal CSV formats:
-- - Max: תאריך עסקה (purchase) + תאריך חיוב (billing), סכום חיוב (charge amount),
--        last-4 card digits per row, foreign currency possible
-- - Cal: transaction date + charge date, סכום עסקה vs סכום חיוב differ for installments,
--        empty סכום חיוב = pending ("עסקה בקליטה"), foreign currency (e.g. $ 33.45 → ₪ 101.22)
-- All monetary values stored as integer agorot (1 ILS = 100 agorot).

-- ─── Import Batches ───────────────────────────────────────────────────────────

CREATE TABLE import_batches (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  UUID        NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  filename    TEXT        NOT NULL,
  row_count   INTEGER     NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY import_batches_owner ON import_batches
  USING (
    account_id IN (
      SELECT id FROM accounts
      WHERE user_id = current_setting('app.current_user_id', true)::uuid
    )
  );

CREATE INDEX import_batches_account_id_idx ON import_batches(account_id);

-- ─── Transaction Status ───────────────────────────────────────────────────────

CREATE TYPE transaction_status AS ENUM ('CLEARED', 'PENDING');

-- ─── Transactions ─────────────────────────────────────────────────────────────
-- Encrypted columns (pgcrypto BYTEA): description, amount_agorot,
--   original_amount_agorot (when foreign currency).
-- Non-sensitive columns stored as plain text/int for filtering/indexing.

CREATE TABLE transactions (
  id                     UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id             UUID               NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  import_batch_id        UUID               REFERENCES import_batches(id),

  -- Dates: purchase date (always present) and billing/charge date (when available)
  transaction_date       DATE               NOT NULL,
  charge_date            DATE,

  -- Merchant name — encrypted
  description            BYTEA              NOT NULL,

  -- Charge amount in agorot (ILS) — encrypted
  -- Positive = debit, negative = credit/cancellation (e.g. Max ביטול עסקה)
  amount_agorot          BYTEA              NOT NULL,

  -- Original foreign-currency amount when transaction was not in ILS (e.g. $ 33.45 → 3345)
  original_amount_agorot BYTEA,
  original_currency      TEXT,              -- ISO 4217, e.g. 'USD', 'EUR'; NULL when ILS

  category               TEXT,              -- provider category (מזון וצריכה, etc.)
  card_last_four         TEXT,              -- last 4 digits of the card used (Max provides this)

  status                 transaction_status NOT NULL DEFAULT 'CLEARED',

  -- Installment info: parsed from הערות column ("תשלום 2 מתוך 6")
  installment_num        INTEGER,
  installment_of         INTEGER,

  -- Dedup hash: SHA-256 of (account_id, transaction_date, description, amount_agorot, installment_num)
  dedupe_hash            TEXT               UNIQUE,

  created_at             TIMESTAMPTZ        NOT NULL DEFAULT now()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY transactions_owner ON transactions
  USING (
    account_id IN (
      SELECT id FROM accounts
      WHERE user_id = current_setting('app.current_user_id', true)::uuid
    )
  );

CREATE INDEX transactions_account_id_idx       ON transactions(account_id);
CREATE INDEX transactions_transaction_date_idx ON transactions(transaction_date);
CREATE INDEX transactions_charge_date_idx      ON transactions(charge_date);
CREATE INDEX transactions_import_batch_id_idx  ON transactions(import_batch_id);
CREATE INDEX transactions_status_idx           ON transactions(status);
