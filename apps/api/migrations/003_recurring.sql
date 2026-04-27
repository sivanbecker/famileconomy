-- Migration: 003_recurring
-- Creates recurring_expenses and recurring_matches tables with RLS

-- ─── Recurring Expenses ───────────────────────────────────────────────────────
-- expected_amount_agorot is encrypted at rest (1 ILS = 100 agorot)

CREATE TABLE recurring_expenses (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                    TEXT        NOT NULL,
  expected_amount_agorot  BYTEA       NOT NULL,  -- pgcrypto encrypted integer (agorot)
  day_of_month            INTEGER     CHECK (day_of_month BETWEEN 1 AND 31),
  match_pattern           TEXT        NOT NULL,
  active                  BOOLEAN     NOT NULL DEFAULT true,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE recurring_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY recurring_expenses_owner ON recurring_expenses
  USING (user_id = current_setting('app.current_user_id', true)::uuid);

CREATE INDEX recurring_expenses_user_id_idx ON recurring_expenses(user_id);

CREATE TRIGGER recurring_expenses_updated_at
  BEFORE UPDATE ON recurring_expenses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── Recurring Matches ────────────────────────────────────────────────────────

CREATE TABLE recurring_matches (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  recurring_expense_id UUID        NOT NULL REFERENCES recurring_expenses(id) ON DELETE CASCADE,
  transaction_id       UUID        NOT NULL UNIQUE REFERENCES transactions(id) ON DELETE CASCADE,
  month                INTEGER     NOT NULL CHECK (month BETWEEN 1 AND 12),
  year                 INTEGER     NOT NULL,
  matched_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE recurring_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY recurring_matches_owner ON recurring_matches
  USING (
    recurring_expense_id IN (
      SELECT id FROM recurring_expenses
      WHERE user_id = current_setting('app.current_user_id', true)::uuid
    )
  );

CREATE INDEX recurring_matches_expense_id_idx ON recurring_matches(recurring_expense_id);
CREATE INDEX recurring_matches_year_month_idx ON recurring_matches(year, month);
