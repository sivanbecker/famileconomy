# Next Session Handoff — Famileconomy

**Date written:** 2026-04-30
**Branch at time of writing:** `feat/cal-charge-date` (PR #37 — merge before starting)

---

## What was completed this session (PR #37)

Three bugs found while testing a real CAL CSV import:

### 1. Wrong monthly total (charge date vs purchase date)

CAL installment rows carry their original purchase date (e.g. January) but belong to a billing cycle in May. `GET /transactions` was filtering by `transactionDate`, so those rows were invisible when viewing May — causing totals to be hundreds of shekels short.

**Fix:** `extractChargeDate()` parses `"עסקאות לחיוב ב-DD/MM/YYYY"` from the CAL header and stamps every transaction as `chargeDate`. The route now uses an `OR` filter: rows with `chargeDate` → filter by billing month; rows without one (MAX, pending CAL) → fall back to `transactionDate`. `transactionDate` (original purchase date) is preserved for future queries.

### 2. FORMAT_MISMATCH on real CAL files

CAL CSVs exported from the web portal use Windows-style `\r\n` inside quoted column headers. `detectFormat` was matching `"סכום\nחיוב"` (LF only), so real files were rejected as format mismatch.

**Fix:** Detection now checks for both `\n` and `\r\n` variants.

### 3. Month navigator blocked at current month

The "next month" button was disabled at the current calendar month. Credit card billing cycles can be ahead of today's date (May statement imported on April 30).

**Fix:** Removed the future-month cap entirely.

### 4. Pending transactions ("עסקה בקליטה")

Rows with `"עסקה בקליטה"` in הערות are in-flight with the credit provider — no `"סכום חיוב"` yet. Previously imported as CLEARED, inflating the total.

**Fix:**

- Parser sets `isPending: true` and `chargeDate: null` for these rows
- Import service saves them as `status: PENDING`
- When the next month's statement arrives with the same merchant + exact amount as CLEARED, the existing PENDING row is promoted to CLEARED and the new row is recorded as DUPLICATE — no manual action needed

**UX note (for expenses view):** PENDING transactions should appear in the list with a visual marker, plus a filter toggle to show/hide them. Do NOT exclude them by default. `summarizeMonth` currently includes PENDING amounts in totals — when building the expenses view, discuss with Sivan whether to exclude PENDING from totals.

---

## Current state of the app

- `/login`, `/register` — working
- `/dashboard` — real KPI data, account selector, month navigator (navigate freely including future months), transaction list (last 10)
- Import modal — provider radio (MAX / CAL); auto-creates accounts; success toast; duplicate file error
- CAL import — charge date stamped on all rows; installments from prior months appear in correct billing month; pending rows stored as PENDING with auto-promotion on settlement
- Month filter — filters by `chargeDate` when present, falls back to `transactionDate`

---

## Known bugs to fix next

### Bug 1 — MAX refund/cancellation inflates הוצאות total

**Symptom:** UI shows ~5009₪ total for MAX cards; CSV footer says 4843.61₪.

**Root cause:** `summarizeMonth` buckets all positive amounts as expenses and all negative amounts as income. A cancellation row (`ביטול עסקה`) has a negative `סכום חיוב` (e.g. -176₪), so it's counted as income rather than as a reduction of expenses. This inflates the expenses KPI by the absolute value of the refund.

**Fix:** Credit card refunds/cancellations are reversals of debits — not income. Two options:

- **Option A (simple):** In `summarizeMonth`, treat negative amounts on transactions as expense reductions (subtract from `expensesAgorot`), not income. Income would need a separate explicit mechanism (salary deposit etc.).
- **Option B (correct but more work):** Add a `transactionType` field (`DEBIT` / `CREDIT` / `REFUND`) and route accordingly.
- **Recommendation:** Option A for now. Confirm with Sivan before implementing.

**Files to touch:** `packages/utils/src/month-summary.ts`, its tests.

---

### Bug 2 — Transaction list missing card/account label

**Symptom:** עסקאות אחרונות shows amount, date, description, category — but not which card the transaction came from.

**Fix:** Add a small label to each transaction row in `TransactionList` showing the account name (or card last four if available). The account name is already stored on `Account` (e.g. "MAX 5432", "CAL 1234"). Two approaches:

- Pass `accountName` down from the dashboard (already known from the account selector)
- Or use `cardLastFour` already returned on each transaction row from `GET /transactions`

**Recommendation:** Use `cardLastFour` — it's already on the transaction and requires no extra API call. Show it as a small muted badge next to the category badge. For accounts where `cardLastFour` is null, fall back to the account name from the store.

**Files to touch:** `apps/web/src/components/transaction-list.tsx`, possibly `apps/web/src/hooks/use-transactions.ts`.

---

## Next task: Category distribution chart + Expenses page (Phase 7b/7d)

### Option A — Category chart first (7b)

Add a pie/donut chart to the dashboard showing expense breakdown by category for the selected month. Uses data already returned by `GET /transactions` (category field). Library: Recharts (already in design).

### Option B — Expenses page first (7d)

Build `/dashboard/expenses` — full paginated transaction list with search, filter by category/date/amount, sort. This is the view where PENDING filtering UI will live.

Both are good next steps. Recommend **Option B** first since it surfaces all the data we just fixed (charge dates, pending status, installment labels) and the category chart can be added to the dashboard after.

---

## Key files to read at session start

| File                                           | Why                                     |
| ---------------------------------------------- | --------------------------------------- |
| `apps/api/src/lib/parsers/cal-parser.ts`       | Charge date + pending logic             |
| `apps/api/src/services/import.service.ts`      | Pending promotion logic                 |
| `apps/api/src/routes/transactions.ts`          | OR filter by chargeDate/transactionDate |
| `apps/web/src/components/transaction-list.tsx` | Starting point for expenses page        |
| `apps/web/src/hooks/use-transactions.ts`       | Query hooks                             |
| `docs/ROADMAP.md`                              | Always read at session start            |

---

## Quality gate reminder

```
npx turbo test lint typecheck format:check
```
