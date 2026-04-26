# Famileconomy — Brainstorming & Planning Log
**App Name:** Famileconomy  
**Status:** Pre-development — Architecture Planning  
**Last Updated:** April 2026  
**Working Environment:** VS Code + Claude Code extension

---

## What We Are Building

A personal and family finance management app for the Israeli market. Helps families understand how much comes in, goes out, what's safe to spend, and what's coming next month.

**Core insight that drives the architecture:** Some fixed recurring expenses (electricity, insurance, internet) are paid by credit card. The system must match imported credit card transactions to predefined recurring expenses to avoid double-counting and to alert when expected charges are missing or changed.

---

## Key Decisions Made

| Decision | Choice | Reasoning |
|---|---|---|
| Primary market | Israel 🇮🇱 | Hebrew UI, ILS currency, Israeli card CSV formats |
| Initial users | Small beta group | Validate before scaling |
| Data residence | Local-first + optional cloud sync | Privacy, offline use, Israeli privacy law compliance |
| Timeline | Flexible — build it right | Solo developer, no hard launch deadline |
| Frontend mobile | React Native + Expo | Developer's existing skillset |
| Frontend web | Next.js (App Router) | Same React knowledge, desktop dashboard |
| Backend | Node.js + TypeScript + Fastify | Developer's existing skillset, type-safe, fast |
| Database (cloud) | PostgreSQL + Prisma | ACID, row-level security, type-safe ORM |
| Database (local mobile) | WatermelonDB (SQLite/SQLCipher) | Built for RN, sync-ready, encrypted |
| Database (local web) | Dexie.js (IndexedDB) | Best DX, TypeScript-native |
| State management | Zustand | Lightweight, works on both platforms |
| Monorepo tooling | Turborepo | Shared types + utils + parsers across apps |
| Infra | Railway (API/DB) + Vercel (web) + Expo EAS (mobile) | Solo-dev friendly, zero DevOps |
| File storage | Cloudflare R2 | Ephemeral CSV storage, zero egress fees |
| Auth | Argon2id + JWT (15min) + rotating refresh tokens | Security-first for financial data |
| Encryption | pgcrypto (cloud) + SQLCipher (local) | Encrypted at rest on all layers |
| Sync protocol | Timestamp-based LWW pull/push | Simple, correct for single-user data |
| Background jobs | BullMQ on Redis | CSV processing, matching, forecasts |

---

## Architecture Summary

### Monorepo Structure
```
/apps/mobile      → React Native + Expo
/apps/web         → Next.js
/apps/api         → Fastify + Node.js

/packages/shared-types    → TypeScript interfaces (source of truth)
/packages/shared-utils    → Currency, dates, math helpers
/packages/parsers         → Bank CSV parsers (Max, Cal, Leumi, Mizrahi)
/packages/matching-engine → Recurring payment matcher + dedup + forecast
```

### Israeli Bank/Card Support
| Provider | Status |
|---|---|
| Max (מקס / לאומי קארד) | MVP — Parser 1 |
| Cal (כאל) + Visa CAL | MVP — Parser 2 |
| Bank Leumi | Phase 2 |
| Bank Mizrahi | Phase 2 |

### Core Data Entities (to be detailed in Doc 02)
- `Transaction` — immutable reality, source of truth
- `RecurringExpense` — definition of expected fixed charges
- `RecurringMatch` — join table: recurring ↔ transaction per month
- `Income` — salary, freelance, refunds
- `MonthlyBudget` — summary + planned vs actual
- `ImportBatch` — CSV import history + dedup tracking
- `Alert` — missing recurring, amount changed, budget exceeded

### Safe-To-Spend Formula
```
SafeToSpend =
  Total Monthly Income
  - Confirmed Expenses So Far (matched + manual)
  - Pending Recurring Expenses (defined but not yet charged)
  - User savings buffer (optional)

Forecast =
  SafeToSpend - (Avg Daily Spend × Remaining Days In Month)
```

---

## UI Summary (from mockups)

### Mobile (bottom nav)
`תמונת מצב | תכנון | [+] הוספה | דוחות | עוד`

### Desktop (right sidebar — RTL)
`תמונת מצב | הכנסות | הוצאות | תקציב | דוחות | תשלומים קבועים | כרטיסי אשראי | יעדים | הגדרות`

### Dashboard Zones
1. Month navigator (← מאי 2024 →)
2. 4 KPI cards: יתרה לבזבז / הכנסות / הוצאות / מאזן (actual + מתוכנן)
3. Month-end forecast chart (actual line + projected dashed line)
4. Category donut chart
5. Recurring payments status (שולם ✓ / צפוי ⏳)
6. Recent transactions feed
7. 3-month historical comparison

### UI Rules
- RTL everywhere (Hebrew-first)
- ILS format: `₪1,234.50` via `Intl.NumberFormat('he-IL')`
- Dates: DD/MM/YYYY, Hebrew month names
- Installments shown as: `תשלום 2/6`

---

## MVP Feature Scope

### IN MVP
- Auth (register, login, JWT)
- Manual income entry
- Manual expense entry
- CSV import: Max + Cal
- Duplicate detection
- Installment grouping (תשלומים)
- Recurring expense definition + matching engine
- Monthly dashboard (all 7 zones above)
- Basic rule-based auto-categorization
- Planned vs actual budget (user sets planned values)

### DEFERRED (Phase 2+)
- Bank Leumi + Mizrahi parsers
- Cloud sync
- Reports screen
- Alerts / push notifications
- Data export
- Multi-currency
- Goals screen (יעדים)
- Multi-card management screen

### DEFERRED (Phase 3)
- Spouse / shared family mode
- AI categorization
- PDF import
- Open banking API integration

---

## Open Questions (Unresolved)

1. **"מתוכנן" (planned) values** — user-set budget targets per month, or auto-calculated from recurring + historical average? This changes the `MonthlyBudget` schema.
2. **Monetization** — Freemium likely, but model not finalized
3. **App Store distribution** — TestFlight for beta, public later
4. **Max CSV encoding** — Windows-1255 or UTF-8? (need to verify with real sample)
5. **Cal installment column format** — need to verify with real sample
6. **Goals data model** — what types of goals? (savings target, debt payoff, budget cap per category?)
7. **Notifications strategy** — in-app alerts only for MVP, or push from day one?

---

## Documents Produced

| # | File | Status |
|---|---|---|
| 01 | `docs/01-system-architecture.md` | ✅ Complete |
| 02 | `docs/02-data-model-and-schema.md` | ⏳ Next |
| 03 | `docs/03-security-model.md` | ⏳ Pending |
| 04 | `docs/04-import-pipeline-spec.md` | ⏳ Pending (needs CSV samples) |
| 05 | `docs/05-mvp-feature-spec.md` | ⏳ Pending |

---

## Recommended MCPs for Claude Code (VS Code)

| MCP | Priority | Use Case |
|---|---|---|
| GitHub MCP | Essential | Issues, PRs, branch management from Claude |
| PostgreSQL MCP | Essential | Schema inspection, query debugging, migration validation |
| Browser MCP | Useful | Visual inspection of running localhost app |
| Filesystem MCP | Built-in | Already handled by Claude Code extension |
