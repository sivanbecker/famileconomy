-- User-authored notes on transactions.
-- The existing `notes` TEXT column on `transactions` is kept as a read-only
-- import-sourced field (הערות from MAX/CAL). This table holds user-authored notes only.
CREATE TABLE transaction_notes (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id  UUID        NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  body            TEXT        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_transaction_notes_transaction_id ON transaction_notes(transaction_id);

-- RLS: only the account owner may see/write notes
ALTER TABLE transaction_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY transaction_notes_owner ON transaction_notes
  USING (
    transaction_id IN (
      SELECT t.id FROM transactions t
      JOIN accounts a ON a.id = t.account_id
      WHERE a.user_id = current_setting('app.current_user_id', true)::uuid
    )
  );
