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

- [~] Run `npx shadcn-ui@latest init` in `apps/web`
- [~] Install `tailwindcss-animate @tailwindcss/typography`
- [~] Apply Claude Design tokens to `globals.css` and `tailwind.config.ts`
- [~] Add base shared components to `packages/ui`: `Button`, `Card`, `Input`, `Badge`, `Dialog`
- [~] Verify RTL rendering in browser (Hebrew layout, logical CSS properties)
- [~] Configure `nativewind` in `apps/mobile` for shared Tailwind tokens on React Native

---

## Phase 5 — Database & Auth (MVP Core)

- [ ] Set up local PostgreSQL via Docker Compose
- [ ] Write initial migration: `001_users_accounts.sql` — `users`, `accounts`, `sessions` tables
- [ ] Write migration: `002_transactions.sql` — `transactions`, `import_batches` tables
- [ ] Write migration: `003_recurring.sql` — `recurring_expenses`, `recurring_matches` tables
- [ ] Write migration: `004_audit_log.sql` — append-only audit log, REVOKE UPDATE/DELETE from app role
- [ ] Enable Row Level Security on all financial tables
- [ ] Set up `db:generate-types` script (introspect DB → `packages/types/src/database.ts`)
- [ ] Implement auth: register + login (Argon2id hashing, JWT 15min, rotating refresh tokens)
- [ ] Implement refresh token rotation: one-time-use, family revocation on reuse
- [ ] Add `GET /health` and `GET /ready` endpoints to Fastify
- [ ] Register `@fastify/helmet`, `@fastify/cors`, `@fastify/rate-limit` on all routes
- [ ] Write unit tests for auth service (TDD: tests first, then implementation)
- [ ] Write unit tests for financial math (edge cases: zero, negative, max safe integer)

> **Release gate:** `v0.1.0-alpha` — auth working end-to-end, DB migrations running, CI fully green.

---

## Phase 6 — Observability Bootstrap

- [ ] Install `pino-pretty` (dev transport) in `apps/api`
- [ ] Install `@logtail/pino` (prod transport) in `apps/api`
- [ ] Initialize OpenTelemetry SDK in `apps/api/src/instrumentation.ts` (loaded before anything else)
- [ ] Add auto-instrumentation for Fastify, `pg`, `ioredis`
- [ ] Sign up for Grafana Cloud free tier — save `OTEL_EXPORTER_OTLP_ENDPOINT` + headers to Railway env
- [ ] Sign up for Better Stack — configure `LOGTAIL_SOURCE_TOKEN` env var
- [ ] Initialize Sentry in `apps/api`, `apps/web`, `apps/mobile`
- [ ] Add `beforeSend` Sentry hook to strip request body / financial data before sending
- [ ] Set up Better Stack uptime monitors for `/health` and `/ready`
- [ ] Create Grafana dashboard: API overview (request rate, error rate, P99 latency)
- [ ] Add OTel manual spans to BullMQ job processors (once workers exist)

---

## Phase 7 — MVP Features (Web)

### 7a — Transaction Import

- [ ] CSV parser: Max (`מקס / לאומי קארד`) — TDD
- [ ] CSV parser: Cal (`כאל`) — TDD
- [ ] Duplicate detection (hash-based dedup per import batch) — TDD
- [ ] Installment grouping (`תשלום 2/6`) — TDD
- [ ] Import API endpoint: `POST /import/csv`
- [ ] BullMQ worker: `csv-import` queue with OTel spans
- [ ] Cloudflare R2 integration for ephemeral CSV storage

### 7b — Core UI (Next.js)

- [ ] Auth pages: Login, Register (Hebrew RTL, i18n keys)
- [ ] Dashboard layout (right sidebar navigation — RTL)
- [ ] Month navigator component
- [ ] 4 KPI cards: יתרה לבזבז / הכנסות / הוצאות / מאזן
- [ ] Transaction list with category badges
- [ ] Recurring payments status panel (שולם ✓ / צפוי ⏳)
- [ ] CSV import flow (upload → preview → confirm)

### 7c — Recurring Engine

- [ ] Recurring expense definition CRUD
- [ ] Matching engine: recurring ↔ imported transaction — TDD
- [ ] BullMQ worker: `matching` queue
- [ ] Monthly budget summary with planned vs actual

### 7d — Safe-to-Spend

- [ ] Implement `SafeToSpend` formula — TDD with edge cases
- [ ] Month-end forecast calculation — TDD
- [ ] Forecast chart component (actual line + projected dashed)

> **Release gate:** `v0.1.0` — MVP complete: auth, import (Max + Cal), recurring matching, dashboard, safe-to-spend. Deploy to Vercel staging.

---

## Phase 8 — MVP Features (Mobile)

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

| Version | Date | Milestone       |
| ------- | ---- | --------------- |
| —       | —    | No releases yet |

---

## How Claude Uses This File

1. At the start of a session: read this file to understand current state.
2. After merging a PR: mark completed tasks `[x]`.
3. When starting a task: mark it `[~]` (in progress).
4. Never remove tasks — mark them `[-]` if deferred with a note.
5. Update the **Release History** table when a version tag is created.
