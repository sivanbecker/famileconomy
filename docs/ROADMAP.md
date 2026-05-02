# Famileconomy — Project Roadmap

> This file is the source of truth for project progress.
> Update task status as work completes: `[ ]` → `[x]`.
> Claude updates this file at the end of every work session.

---

## Status Legend

| Symbol | Meaning                   |
| ------ | ------------------------- |
| `[x]`  | Done — merged to main     |
| `[~]`  | In progress — branch open |
| `[ ]`  | Not started               |
| `[-]`  | Skipped / deferred        |

---

## Phase 1 — Repository Setup

- [x] Create GitHub repository (public)
- [x] Enable branch protection on `main` (require PR + CI pass, no force-push)
- [x] Enable GitHub Secret Scanning (enabled by default on public repos)
- [x] Enable Dependabot — add `.github/dependabot.yml`
- [x] Set up GitHub Environments: `staging` and `production`
- [x] Add `SNYK_TOKEN` secret
- [ ] Add `VERCEL_TOKEN` secret (needed before deploy-to-staging job runs)
- [ ] Add `RAILWAY_TOKEN` secret (needed before deploy-to-staging job runs)
- [ ] Add `DATABASE_URL_TEST` secret (needed for migration lint + E2E tests)

---

## Phase 2 — Monorepo Scaffold

- [x] Initialize Turborepo workspace structure (`apps/web`, `apps/mobile`, `apps/api`, `packages/types`, `packages/utils`, `packages/ui`)
- [x] Configure `turbo.json` pipelines (`build`, `test`, `lint`, `typecheck`, `format:check`, `db:migrate`, `db:migrate:check`)
- [x] Configure root `package.json` with npm workspaces and `"type": "module"`
- [x] Create `tsconfig.base.json` with strict settings (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`)
- [x] Set up ESLint 9 flat config (`eslint.config.js`) with TypeScript strict + security plugin
- [x] Set up Prettier
- [x] Set up Husky hooks: `pre-commit` (lint-staged), `pre-push` (typecheck + Trivy), `commit-msg` (commitlint)
- [x] Set up commitlint with conventional commit types including `security:` and `mobile:`
- [x] Stub packages: `@famileconomy/types`, `@famileconomy/utils`, `@famileconomy/ui`
- [x] Stub shared types: `Transaction`, `Account`, `Budget`, `RecurringExpense`, `User`
- [x] Stub shared utils: `toShekels`, `fromShekels`, `formatILS`, financial math helpers, date helpers
- [x] Add `.trivyignore` for known Expo 51 toolchain CVEs (xmldom, node-tar) — resolve on Expo 55 upgrade
- [x] Upgrade to Next.js 16 (fixes DoS CVEs from Next 14), Fastify 5, node-pg-migrate 8
- [x] CI green: format + lint + typecheck + unit tests + security scan + migration lint

---

## Phase 3 — CI/CD & Release Pipeline

- [x] GitHub Actions CI: format, lint, typecheck, unit tests, build, security scan, migration lint
- [x] Add `release-please.yml` workflow
- [x] Add `release-please-config.json` and `.release-please-manifest.json`
- [x] Add `codeql.yml` workflow (static security analysis — `continue-on-error: true`; repo is now public so it runs)
- [ ] Set Snyk `continue-on-error: false` (currently non-blocking: free plan quota exhausted; `npm audit` + Trivy are blocking in the meantime)
- [x] Add `npm audit --audit-level=high` step to CI security job

> **Release gate:** First release (`v0.1.0`) is tagged after Phase 5 (auth + database) is complete and CI is fully green including E2E.

---

## Phase 4 — Design System

- [x] Run `npx shadcn-ui@latest init` in `apps/web`
- [x] Install `tailwindcss-animate @tailwindcss/typography`
- [x] Apply Claude Design tokens to `globals.css` and `tailwind.config.ts`
- [x] Add base shared components to `packages/ui`: `Button`, `Card`, `Input`, `Badge`, `Dialog`
- [x] Verify RTL rendering in browser (Hebrew layout, logical CSS properties)
- [x] Configure `nativewind` in `apps/mobile` for shared Tailwind tokens on React Native

---

## Phase 5 — Database & Auth (MVP Core)

- [x] Set up local PostgreSQL via Docker Compose
- [x] Write initial migration: `001_users_accounts.sql` — `users`, `accounts`, `sessions` tables
- [x] Write migration: `002_transactions.sql` — `transactions`, `import_batches` tables
- [x] Write migration: `003_recurring.sql` — `recurring_expenses`, `recurring_matches` tables
- [x] Write migration: `004_audit_log.sql` — append-only audit log, REVOKE UPDATE/DELETE from app role
- [x] Enable Row Level Security on all financial tables
- [x] Set up `db:generate-types` script (introspect DB → `packages/types/src/database.ts`)
- [x] Implement auth: register + login (Argon2id hashing, JWT 15min, rotating refresh tokens)
- [x] Implement refresh token rotation: one-time-use, family revocation on reuse
- [x] Add `GET /health` and `GET /ready` endpoints to Fastify
- [x] Register `@fastify/helmet`, `@fastify/cors`, `@fastify/rate-limit` on all routes
- [x] Write unit tests for auth service (TDD: tests first, then implementation)
- [x] Write unit tests for financial math (edge cases: zero, negative, max safe integer)

> **Release gate:** `v0.1.0-alpha` — auth working end-to-end, DB migrations running, CI fully green.

---

## Phase 6 — Observability Bootstrap

- [x] Install `pino-pretty` (dev transport) in `apps/api`
- [x] Install `@logtail/pino` (prod transport) in `apps/api`
- [x] Initialize OpenTelemetry SDK in `apps/api/src/instrumentation.ts` (loaded before anything else)
- [x] Add auto-instrumentation for Fastify, `pg`, `ioredis`
- [-] Sign up for Grafana Cloud free tier — save `OTEL_EXPORTER_OTLP_ENDPOINT` + headers to Railway env (deferred: credentials wired, Grafana token scope issue — revisit after Railway deploy in Phase 9)
- [-] Sign up for Better Stack — configure `LOGTAIL_SOURCE_TOKEN` env var (deferred: free log drain not available in current UI flow — revisit after Phase 7)
- [x] Initialize Sentry in `apps/api`, `apps/web`, `apps/mobile`
- [x] Add `beforeSend` Sentry hook to strip request body / financial data before sending
- [-] Set up Better Stack uptime monitors for `/health` and `/ready` (deferred: needs deployed URL — revisit in Phase 9)
- [-] Create Grafana dashboard: API overview (request rate, error rate, P99 latency) (deferred: revisit after Grafana token issue resolved)
- [ ] Add OTel manual spans to BullMQ job processors (once workers exist)

---

## Phase 7 — MVP Features (Web)

### 7a — Transaction Import

- [x] CSV parser: Max (`מקס / לאומי קארד`) — TDD
- [x] CSV parser: Cal (`כאל`) — TDD
- [x] Installment grouping (`תשלום 2/6`) — TDD
- [x] Row-level dedup: SHA-256 hash of `accountId|date|amountAgorot|description`; duplicates inserted as `status=DUPLICATE` with `duplicate_of` FK pointing at the original — TDD
- [x] Batch-level dedup: SHA-256 hash of full file content stored on `import_batches`; re-uploading the same file returns 409 before any rows are processed — TDD
- [x] `DUPLICATE` / `REVIEWED_OK` enum values + `duplicate_of` self-referential FK on `transactions` (migrations 005, 006)
- [x] `file_hash` column on `import_batches` with partial unique index (migration 007)
- [x] Import API endpoint: `POST /import/csv` — returns `{ inserted, duplicates, errors }`
- [x] `postinstall` hook runs `prisma generate` so CI always has up-to-date enum types
- [-] BullMQ worker: `csv-import` queue with OTel spans (deferred: sync import sufficient for MVP; easy to add async path later — revisit Phase 9/10)
- [-] Cloudflare R2 integration for ephemeral CSV storage (deferred: not needed without async worker — revisit Phase 9/10)

### 7b — Core UI (Next.js)

- [x] Auth pages: Login, Register (Hebrew RTL, Zod validation)
- [x] Axios API client with 401 interceptor → redirect to `/login`
- [x] Zustand auth store (`id`, `name`, `locale`) — hydrated via `GET /auth/me` on mount
- [x] `GET /auth/me` API endpoint (rotates refresh token cookie, returns user)
- [x] Dashboard layout: RTL sidebar with logo, grouped nav sections, active state, user avatar + logout
- [x] Month navigator component (Hebrew month names, no future-month cap — billing cycles can be ahead of calendar date)
- [x] 4 KPI cards with icon, display-size amount, variant colours, budget sublabel
- [x] Design system wired end-to-end: `postcss.config.mjs` + inlined Tailwind tokens → dark "Obsidian Wealth" theme renders correctly
- [x] Dashboard page: topbar, KPI row, chart placeholder panels, recent transactions + recurring placeholder cards
- [x] CSV import page with account selector and success/error feedback
- [x] Transaction list with category badges (real data from API)
- [x] Auto-create accounts on import: extract card identifiers from parsers, findOrCreateAccount in service, provider radio in modal
- [x] CAL: parse charge date from billing header; filter transactions by chargeDate so installments from prior months appear in the correct billing month
- [x] CAL: detect CRLF line endings inside quoted column headers (Windows exports)
- [x] CAL: detect "עסקה בקליטה" → store as PENDING; auto-promote to CLEARED when settled version arrives in a later statement
- [x] Fix: MAX refund/cancellation (negative amounts) treated as expense reductions, not income
- [x] Fix: transaction list rows show card last four / account label (colorful badges per card)
- [x] Fix: CAL parser now stamps cardLastFour from header onto every row
- [x] Dashboard: "כל החשבונות" all-accounts view as default in account selector
- [x] Category distribution chart (pie/donut by category, Recharts) on dashboard
- [x] Google Drive batch import — async folder walk, CSV detect, batch import (OAuth, service, routes; worker + frontend deferred to Phase 8)
- [~] Google Drive async worker — BullMQ job processing with progress tracking and audit logging
- [ ] Recurring payments status panel (שולם ✓ / צפוי ⏳) (real data from API)
- [ ] CSV import flow: preview before confirm

### 7c — Recurring Engine

- [ ] Recurring expense definition CRUD (`POST/GET/PUT/DELETE /recurring`)
- [ ] Matching engine: recurring ↔ imported transaction — TDD
- [ ] Monthly recurring status: `MATCHED` / `PENDING` / `MISSED` per expense per month
- [ ] Recurring status panel on dashboard (real data from API)
- [-] BullMQ worker: `matching` queue (deferred: sync matching sufficient for MVP — revisit Phase 9/10)

### 7d — Expenses Page

- [x] `GET /transactions` pagination + filtering by category, date range, min/max amount
- [x] Expenses page (`/dashboard/expenses`): full transaction list with search, filter, sort
- [x] Transaction detail / edit category inline
- [x] Anomaly highlighting (transactions > 2× category average)

### 7e — Safe-to-Spend

- [ ] Implement `SafeToSpend` formula — TDD with edge cases
- [ ] Month-end forecast calculation — TDD
- [ ] Forecast chart component (actual line + projected dashed)

> **Release gate:** `v0.1.0` — MVP complete: auth, import (Max + Cal), recurring matching, dashboard with charts, expenses page, safe-to-spend. Deploy to Vercel staging.

---

## Phase 8 — MVP Features (Mobile)

- [ ] **Before starting mobile:** fix `apps/web/tailwind.config.ts` to import from `@famileconomy/ui/tailwind.config` (package import) instead of the current inlined duplicate — so both web and mobile share a single source of truth for design tokens (web currently has a copy because the `require()` preset approach failed for `.ts` files; the fix is to resolve via the package `exports` map)
- [ ] Auth screens: Login, Register (Expo Router)
- [ ] Bottom nav: תמונת מצב | תכנון | [+] | דוחות | עוד
- [ ] Dashboard screen (KPI cards, recurring status, recent transactions)
- [ ] CSV import via device file picker
- [ ] WatermelonDB local schema (mirrors cloud schema)
- [ ] Local-first sync: push/pull with timestamp-based LWW
- [ ] SQLCipher key in Expo SecureStore (never AsyncStorage)
- [ ] Maestro E2E test: login → import CSV → view dashboard

---

## Phase 9 — Beta Release

- [ ] E2E tests (Playwright web): login, import, view balance, create budget
- [ ] Deploy API to Railway production
- [ ] Deploy web to Vercel production
- [ ] Submit mobile to TestFlight (EAS build)
- [ ] Set Snyk `continue-on-error: false`
- [ ] Configure CORS to explicit origins (never `origin: '*'`)
- [ ] Security review checklist: auth, refresh tokens, audit log, RLS, CORS
- [ ] Set up Better Stack alerts: API error rate > 1%, queue depth > 50, P99 > 2s
- [ ] Write `README.md` with quick-start, tech stack, env vars reference

> **Release gate:** `v0.2.0` — beta to TestFlight + Vercel prod. Tag after all E2E pass and security checklist signed off.

---

## Phase 10 — Post-Beta (Phase 2 Features)

- [ ] Bank Leumi CSV parser
- [ ] Bank Mizrahi CSV parser
- [ ] Reports screen
- [ ] Push notifications (missing recurring, budget exceeded)
- [ ] Data export (CSV, JSON)
- [ ] Goals screen (יעדים) — savings targets, debt payoff
- [ ] Multi-card management screen
- [ ] OWASP ZAP weekly automated scan against staging
- [ ] Expo 55 upgrade (resolves remaining `.trivyignore` CVEs)

---

## Release History

| Version      | Date       | Milestone                                                      |
| ------------ | ---------- | -------------------------------------------------------------- |
| v0.1.0-alpha | 2026-04-27 | Auth end-to-end, DB migrations, Fastify server, CI fully green |

---

## How Claude Uses This File

1. At the start of a session: read this file to understand current state.
2. After merging a PR: mark completed tasks `[x]`.
3. When starting a task: mark it `[~]` (in progress).
4. Never remove tasks — mark them `[-]` if deferred with a note.
5. Update the **Release History** table when a version tag is created.
