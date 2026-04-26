# Document 01 — System Architecture
## Family Finance Management App (קופת המשפחה)
**Version:** 1.0  
**Status:** Draft — Pre-Development  
**Author:** Architecture Session  
**Last Updated:** April 2026

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architectural Principles](#2-architectural-principles)
3. [System Topology](#3-system-topology)
4. [Monorepo Structure](#4-monorepo-structure)
5. [Frontend Architecture](#5-frontend-architecture)
6. [Backend Architecture](#6-backend-architecture)
7. [Local-First Architecture](#7-local-first-architecture)
8. [Cloud Sync Architecture](#8-cloud-sync-architecture)
9. [Security Architecture](#9-security-architecture)
10. [Observability Architecture](#10-observability-architecture)
11. [Import Pipeline Architecture](#11-import-pipeline-architecture)
12. [Data Flow Diagrams](#12-data-flow-diagrams)
13. [Infrastructure & Deployment](#13-infrastructure--deployment)
14. [Scalability Model](#14-scalability-model)
15. [MVP Boundaries](#15-mvp-boundaries)
16. [Open Questions & Decisions Log](#16-open-questions--decisions-log)

---

## 1. Project Overview

### What We Are Building

A personal and family finance management application targeting the Israeli market (ILS primary currency). The app allows families to:

- Track monthly income vs. expenses
- Import credit card statements from Israeli providers (Max, Cal, Leumi, Mizrahi)
- Manage and match recurring/fixed expenses (תשלומים קבועים)
- Forecast remaining spend until month end
- View historical monthly comparisons
- Avoid double-counting fixed expenses that appear on credit cards

### Primary Market Constraints

| Constraint | Detail |
|---|---|
| Primary currency | ILS (₪) |
| Secondary currencies | USD, EUR (foreign subscriptions) |
| Card providers supported | Max, Cal, Visa CAL, Bank Leumi, Bank Mizrahi |
| CSV encoding | Hebrew (Windows-1255 or UTF-8 depending on provider) |
| Date format | DD/MM/YYYY |
| Installment payments | תשלומים — core concept, must be modeled natively |
| Standing orders | הוראת קבע — bank transfers, not credit card |
| Privacy law | Israeli Privacy Protection Law (חוק הגנת הפרטיות) |

### Target Users (Phase 1)

Small beta group of Israeli families. Single user per account initially, with spouse/shared mode planned for Phase 3.

---

## 2. Architectural Principles

These principles govern every technical decision made in this project. When in doubt, return to this list.

### P1 — Local-First
User data lives on the device. The app is fully functional offline. Cloud sync is an optional enhancement, never a requirement for core functionality. This also improves our privacy compliance posture significantly.

### P2 — Security by Default
Financial data is among the most sensitive data a person holds. Encryption, data isolation, and principle of least privilege are not phase-2 concerns — they are foundational.

### P3 — Single Source of Truth
A `Transaction` is immutable reality. Once imported or entered, it is never silently modified. All derived data (monthly totals, forecasts, matching status) is computed from transactions, never stored in place of them.

### P4 — Type Safety End-to-End
TypeScript everywhere — mobile, web, and backend. Shared types via the monorepo `/packages/shared-types` package. A type mismatch caught at compile time cannot cause a production bug.

### P5 — Explicit Over Implicit
The matching engine that links recurring expenses to transactions must be inspectable and explainable to the user. No black-box logic that silently modifies financial records.

### P6 — Solo-Developer Friendly
Every architectural choice must be maintainable by one person. Complexity is added only when it solves a real problem that simpler approaches cannot. Managed services are preferred over self-hosted infrastructure wherever cost is acceptable.

### P7 — Designed to Scale
The MVP is built for a small beta group, but the architecture anticipates 10,000+ users without fundamental redesign. This means: stateless API servers, row-level data isolation, async processing for heavy jobs, and a database schema that does not require migrations for user growth.

---

## 3. System Topology

```
┌─────────────────────────────────────────────────────────────┐
│                        USER DEVICES                         │
│                                                             │
│  ┌──────────────────────┐    ┌──────────────────────────┐   │
│  │   Mobile App         │    │   Web App (Desktop)      │   │
│  │   React Native/Expo  │    │   Next.js                │   │
│  │                      │    │                          │   │
│  │  ┌────────────────┐  │    │  ┌────────────────────┐  │   │
│  │  │ WatermelonDB   │  │    │  │ IndexedDB (Dexie)  │  │   │
│  │  │ (SQLite/enc.)  │  │    │  │                    │  │   │
│  │  └────────┬───────┘  │    │  └─────────┬──────────┘  │   │
│  └───────────┼──────────┘    └────────────┼─────────────┘   │
└──────────────┼─────────────────────────────┼─────────────────┘
               │  HTTPS / WSS (sync only)    │
               ▼                             ▼
┌─────────────────────────────────────────────────────────────┐
│                      CLOUD LAYER (optional sync)            │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              API Server (Fastify + Node.js)          │   │
│  │              Stateless — horizontally scalable       │   │
│  └──────────┬───────────────────┬────────────────────────┘   │
│             │                   │                            │
│  ┌──────────▼──────┐   ┌────────▼─────────┐                 │
│  │  PostgreSQL     │   │  Redis           │                 │
│  │  (primary data) │   │  (cache, queues) │                 │
│  └─────────────────┘   └──────────────────┘                 │
│                                                             │
│  ┌───────────────────────────────────────┐                  │
│  │  BullMQ Workers (CSV processing,      │                  │
│  │  matching engine, forecast jobs)      │                  │
│  └───────────────────────────────────────┘                  │
│                                                             │
│  ┌───────────────────────────────────────┐                  │
│  │  Cloudflare R2 (temp CSV storage,     │                  │
│  │  deleted after processing)            │                  │
│  └───────────────────────────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

### Key Topology Rules

1. **The API server is stateless.** No user session state is stored in memory. All state lives in PostgreSQL or Redis. This allows horizontal scaling with zero coordination.
2. **The local DB is the primary for offline use.** When online, it syncs to cloud as a backup/multi-device layer.
3. **CSV files are ephemeral.** They are uploaded to R2, processed by a BullMQ worker, and deleted. Raw bank data never persists in storage.
4. **Workers are separate processes.** CSV parsing and matching never block the API request/response cycle.

---

## 4. Monorepo Structure

### Tooling: Turborepo

Turborepo is the monorepo build system. It provides:
- Incremental builds (only rebuild changed packages)
- Shared TypeScript configurations
- Pipeline definitions (build → test → lint in correct order)
- Remote caching (optional, speeds up CI)

### Directory Structure

```
/family-finance/
├── turbo.json                    # Turborepo pipeline config
├── package.json                  # Root workspace config
├── tsconfig.base.json            # Shared TS config
│
├── /apps/
│   ├── /mobile/                  # React Native + Expo
│   │   ├── app/                  # Expo Router file-based routing
│   │   ├── components/
│   │   ├── stores/               # Zustand stores
│   │   ├── db/                   # WatermelonDB schema + models
│   │   └── package.json
│   │
│   ├── /web/                     # Next.js (App Router)
│   │   ├── app/                  # Next.js app directory
│   │   ├── components/
│   │   ├── stores/               # Zustand stores (same pattern as mobile)
│   │   └── package.json
│   │
│   └── /api/                     # Fastify + Node.js backend
│       ├── src/
│       │   ├── routes/           # API route handlers
│       │   ├── services/         # Business logic layer
│       │   ├── workers/          # BullMQ job processors
│       │   ├── middleware/       # Auth, rate limiting, etc.
│       │   └── db/               # Prisma client + migrations
│       └── package.json
│
└── /packages/
    ├── /shared-types/            # TypeScript interfaces — source of truth
    │   ├── src/
    │   │   ├── transaction.ts
    │   │   ├── recurring.ts
    │   │   ├── budget.ts
    │   │   ├── income.ts
    │   │   └── index.ts
    │   └── package.json
    │
    ├── /shared-utils/            # Pure functions shared across apps
    │   ├── src/
    │   │   ├── currency.ts       # ILS/USD/EUR formatting
    │   │   ├── dates.ts          # DD/MM/YYYY, Hebrew month names
    │   │   ├── math.ts           # Safe arithmetic (no float errors)
    │   │   └── categories.ts     # Category constants + icons
    │   └── package.json
    │
    ├── /parsers/                 # Bank CSV/Excel parsers
    │   ├── src/
    │   │   ├── base-parser.ts    # Abstract base class
    │   │   ├── max-parser.ts     # Max (לאומי קארד / מקס)
    │   │   ├── cal-parser.ts     # Cal (כאל) + Visa CAL
    │   │   ├── leumi-parser.ts   # Bank Leumi
    │   │   ├── mizrahi-parser.ts # Bank Mizrahi
    │   │   └── index.ts
    │   └── package.json
    │
    └── /matching-engine/         # Recurring payment matcher
        ├── src/
        │   ├── matcher.ts        # Core matching logic
        │   ├── dedup.ts          # Duplicate detection
        │   └── forecast.ts       # Month-end projection
        └── package.json
```

### Why This Structure

- `/packages/parsers` is isolated and independently testable. Each bank parser can have its own test suite with real (anonymized) CSV samples.
- `/packages/matching-engine` contains the most complex business logic. Isolating it means it can be unit tested exhaustively without spinning up a full app.
- `/packages/shared-types` is the contract between all parts of the system. A type change here surfaces errors everywhere at compile time.

---

## 5. Frontend Architecture

### Mobile — React Native + Expo

| Concern | Solution | Rationale |
|---|---|---|
| Framework | React Native + Expo SDK | OTA updates, managed builds, no Xcode required for every release |
| Routing | Expo Router (file-based) | Same mental model as Next.js, deep linking built-in |
| State management | Zustand | No boilerplate, works offline, easy to persist to local DB |
| Local database | WatermelonDB | Built for RN, SQLite under the hood, designed for sync |
| Styling | NativeWind (Tailwind for RN) | Shared utility classes with web, RTL support via `I18nManager` |
| Forms | React Hook Form + Zod | Type-safe, minimal re-renders |
| Charts | Victory Native | Supports RN, good Hebrew/RTL compatibility |
| HTTP client | Axios with interceptors | JWT refresh handling, offline queue |
| i18n/RTL | i18next + React Native RTL | Hebrew-first, all layouts right-to-left |

### Web — Next.js (App Router)

| Concern | Solution | Rationale |
|---|---|---|
| Framework | Next.js 14+ App Router | SSR for initial load, React Server Components for dashboard |
| State management | Zustand (same stores as mobile) | Consistency across platforms |
| Local database | Dexie.js (IndexedDB wrapper) | Best DX for IndexedDB, TypeScript-native |
| Styling | Tailwind CSS | Consistent with NativeWind, utility-first |
| Forms | React Hook Form + Zod (same as mobile) | Shared validation schemas via shared-types |
| Charts | Recharts | Mature, customizable, RTL-compatible |
| i18n/RTL | next-intl | App Router compatible, RTL layout via `dir="rtl"` |

### Shared UI Rules

1. **RTL everywhere.** The app is Hebrew-first. All flexbox directions, text alignment, and icon positioning must default to RTL. LTR is the exception (e.g., displaying IBANs or English merchant names).
2. **Currency display.** Always show ₪ symbol before the number (₪1,234.50). Use `Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS' })`.
3. **Date display.** Always DD/MM/YYYY format. Month names in Hebrew. Use the `shared-utils/dates.ts` utility — never format dates inline.
4. **Installment display.** Show as "תשלום 2/6" next to the amount. Never show the installment amount alone without context.

### Navigation Structure (from UI Mockups)

**Mobile (bottom tab bar):**
```
תמונת מצב | תכנון | [+] הוספה | דוחות | עוד
```

**Desktop (left sidebar, RTL = right sidebar):**
```
תמונת מצב (Dashboard)
הכנסות (Income)
הוצאות (Expenses)
תקציב (Budget)
דוחות (Reports)
תשלומים קבועים (Recurring Payments)
כרטיסי אשראי (Credit Cards)
יעדים (Goals)
הגדרות (Settings)
```

---

## 6. Backend Architecture

### Framework: Fastify (not Express)

Fastify is chosen over Express for the following reasons:
- Native TypeScript support with full type inference on routes
- Built-in JSON schema validation (Ajv) — validates request/response shapes automatically
- 3x faster than Express in benchmarks (matters at scale)
- Built-in plugin system with proper encapsulation
- Better async/await error handling

### Layered Architecture

```
Request
  → Rate Limiter (Redis-based)
  → Auth Middleware (JWT validation)
  → Route Handler (thin — only HTTP concerns)
    → Service Layer (business logic)
      → Repository Layer (Prisma — DB access only)
        → PostgreSQL
```

**Rule:** Route handlers never touch the database directly. Services never construct HTTP responses. This separation makes unit testing each layer trivial.

### API Design

REST with a small number of well-designed endpoints. No GraphQL for MVP — overkill for one developer.

```
POST   /auth/register
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout

GET    /transactions?month=2024-05&page=1&limit=50
POST   /transactions
PATCH  /transactions/:id
DELETE /transactions/:id

GET    /recurring
POST   /recurring
PATCH  /recurring/:id
DELETE /recurring/:id

GET    /income?year=2024
POST   /income

GET    /budget/summary?month=2024-05
GET    /budget/forecast?month=2024-05

POST   /import/upload          # Returns presigned R2 URL
POST   /import/process         # Triggers BullMQ job
GET    /import/batches          # Import history
GET    /import/batches/:id/status

GET    /sync/pull?since=<timestamp>   # Cloud sync
POST   /sync/push
```

### Background Workers (BullMQ)

| Queue | Job | Trigger |
|---|---|---|
| `csv-import` | Parse + normalize CSV, dedup, run matcher | POST /import/process |
| `matching` | Re-run matching engine for a month | Month close, recurring update |
| `forecast` | Recompute month-end forecast | New transaction added |
| `notifications` | Send alert (missing recurring, budget exceeded) | Scheduled daily |

Workers run as separate Node.js processes. They share the same `/packages/parsers` and `/packages/matching-engine` code.

---

## 7. Local-First Architecture

### The Core Principle

The app must work 100% offline. This means:
- All CRUD operations write to the local DB first
- The local DB is the authoritative source for the UI
- Cloud sync is a background process, not a prerequisite

### Mobile: WatermelonDB

WatermelonDB is built specifically for this pattern:
- Lazy loading — only loads records that are actually rendered
- Reactive queries — UI updates automatically when DB changes
- Built-in sync protocol (push/pull with conflict resolution)
- SQLite under the hood (encrypted via SQLCipher)

```typescript
// Example: Reactive transaction list
const TransactionList = withObservables(['month'], ({ month }) => ({
  transactions: database.collections
    .get('transactions')
    .query(Q.where('month', month))
    .observe()
}))
```

### Web: Dexie.js (IndexedDB)

For the web app, IndexedDB via Dexie provides:
- Async/await API over IndexedDB
- TypeScript-native schema definitions
- Live queries via `useLiveQuery` hook
- Sufficient storage for years of transaction history

### Conflict Resolution Strategy

When the same record is modified on two devices while offline, we need a resolution strategy.

**Decision: Last-Write-Wins with timestamp (LWW)**

For financial data, LWW is acceptable because:
1. Most edits are additive (new transactions), not conflicting updates
2. The same transaction is unlikely to be edited on two devices simultaneously
3. The user can see and correct any wrong values

**Exception: Deletions.** A deleted record on device A must propagate as a deletion to device B, not be resurrected by a sync. We use a `deletedAt` soft-delete timestamp — records are never hard-deleted during sync, only marked.

---

## 8. Cloud Sync Architecture

### Sync Protocol

We use a simple **timestamp-based pull/push** protocol. Not CRDTs (too complex for MVP), not operational transforms. Just timestamps.

```
Pull cycle (device → server):
  1. Device sends: GET /sync/pull?since=<last_sync_timestamp>
  2. Server returns: all records updated after that timestamp, for this userId
  3. Device merges: LWW by updatedAt timestamp
  4. Device updates: local last_sync_timestamp

Push cycle (device → server):
  1. Device collects: all records with updatedAt > last_push_timestamp
  2. Device sends: POST /sync/push { records: [...] }
  3. Server validates: userId matches on every record (security check)
  4. Server upserts: into PostgreSQL
  5. Server returns: conflicts (if any) + server timestamps
```

### Sync Triggers

- App comes to foreground (after background)
- User manually pulls to refresh
- Every 15 minutes while app is active
- Immediately after any write operation (debounced, 3 second delay)

### What Gets Synced vs. What Stays Local

| Data | Synced to Cloud | Notes |
|---|---|---|
| Transactions | Yes (encrypted) | Core data |
| Recurring expenses | Yes (encrypted) | Core data |
| Income entries | Yes (encrypted) | Core data |
| Monthly budget | Yes (encrypted) | Derived but user-editable |
| Import batches metadata | Yes | For dedup across devices |
| Raw CSV files | Never | Processed and discarded |
| User preferences/settings | Yes | Theme, language, etc. |
| Auth tokens | Never | Device-local only |

---

## 9. Security Architecture

### Threat Model

We are protecting against:
1. **Server breach** — attacker gains DB access → encrypted data is useless without user keys
2. **Man-in-the-middle** — TLS + certificate pinning on mobile
3. **Unauthorized API access** — JWT + refresh token rotation
4. **Cross-user data access** — Row-level security at DB layer
5. **Replay attacks** — Short-lived JWT (15 min)
6. **Brute force** — Rate limiting on auth endpoints

### Password Hashing

**Algorithm: Argon2id** — mandatory, no exceptions.

Argon2id is the winner of the Password Hashing Competition and is memory-hard, making GPU and ASIC attacks impractical. Parameters: `memory: 65536` (64 MB), `iterations: 3`, `parallelism: 4`.

Never use bcrypt, scrypt, PBKDF2, or any hash function without a memory-hard property for user password storage.

### JWT Strategy

```
Access Token:
  - Expires: 15 minutes
  - Payload: { userId, deviceId, iat, exp }
  - Stored: Memory only (never localStorage, never AsyncStorage plain)
  - Signing: RS256 (asymmetric) — private key on API, public key verifiable anywhere

Refresh Token:
  - Expires: 30 days (sliding window)
  - Stored: httpOnly + Secure + SameSite=Strict cookie (web) / Expo SecureStore (mobile)
  - One-time use: Rotated on EVERY use — old token is immediately invalidated in DB
  - Stored in DB: SHA-256 hash of the token (never plaintext), with deviceId, issuedAt, revokedAt
  - Refresh token family: if a reused (already-rotated) token is presented, the entire session
    family is revoked (detects token theft / replay)
```

**Refresh Token Rotation Algorithm:**
```
1. Client presents refresh token RT_n
2. Server looks up hash(RT_n) in token table
   → Not found or revokedAt IS NOT NULL → REVOKE ALL tokens for this session family → force re-login
   → Found and valid → continue
3. Server issues new access token AT_n+1 and new refresh token RT_n+1
4. Server marks RT_n as revokedAt = NOW() in DB
5. Server stores hash(RT_n+1) linked to same session family
6. Server returns AT_n+1 and RT_n+1 to client
```

This "refresh token family" pattern (pioneered by Auth0's research) means a stolen refresh token is detected and the entire session is killed at most one use after theft.

### Data Encryption

**At-rest encryption (cloud):**

All financial data columns in PostgreSQL are encrypted using `pgcrypto` with per-user encryption keys. The user's encryption key is derived from their password using PBKDF2 and never stored in plaintext on the server.

```
User password
  → PBKDF2(password, userSalt, 310000 iterations, SHA-256)
  → userDerivedKey (stored only in memory during session)
  → Used to encrypt/decrypt data columns
```

**At-rest encryption (local/mobile):**

WatermelonDB uses SQLCipher (AES-256) for full database encryption on device. The encryption key is stored in the device's secure enclave via Expo SecureStore.

**In transit:**

- TLS 1.3 minimum
- HSTS with `max-age=31536000; includeSubDomains; preload`
- Certificate pinning on mobile (Expo managed)

### API Security

```typescript
// Every Prisma query is scoped to userId via middleware
// This is a defense-in-depth layer on top of JWT validation

prisma.$use(async (params, next) => {
  const userId = getCurrentUserId(); // from request context
  if (params.action === 'findMany') {
    params.args.where = { ...params.args.where, userId };
  }
  return next(params);
});
```

Additionally, PostgreSQL Row Level Security (RLS) is enabled as a second independent layer. Even if application code has a bug that fails to scope a query, the database rejects cross-user data access.

**Application-layer scoping (Prisma middleware) + RLS = defense-in-depth.** Both must be present. Application code can have bugs; the DB layer cannot be bypassed by application bugs.

### Audit Log

Every mutation of financial data writes an append-only row to `audit_log`. This is non-negotiable.

```sql
CREATE TABLE audit_log (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES users(id),
  table_name    text        NOT NULL,
  record_id     uuid        NOT NULL,
  action        text        NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_value     jsonb,      -- pgcrypto encrypted; NULL for INSERT
  new_value     jsonb,      -- pgcrypto encrypted; NULL for DELETE
  performed_by  uuid        NOT NULL REFERENCES users(id),
  performed_at  timestamptz NOT NULL DEFAULT now(),
  trace_id      text        -- OpenTelemetry trace ID for cross-system correlation
);

-- Application DB role has INSERT only — no UPDATE or DELETE
REVOKE UPDATE, DELETE ON audit_log FROM app_role;
CREATE INDEX idx_audit_user_time ON audit_log(user_id, performed_at DESC);
CREATE INDEX idx_audit_record ON audit_log(table_name, record_id);
```

Tables that require audit logging: `transactions`, `recurring_expenses`, `income_entries`, `budgets`, `import_batches`.

### CORS Policy

```typescript
fastify.register(require('@fastify/cors'), {
  origin: process.env.ALLOWED_ORIGINS?.split(',') ?? [],  // explicit whitelist only
  credentials: true,    // required for httpOnly cookie auth
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
})
// Never use origin: '*' — this would allow any website to make credentialed requests
```

### Compliance (Israeli Privacy Protection Law)

| Requirement | Implementation |
|---|---|
| Right to deletion | Hard delete endpoint — cascades all user data including audit log (exception: audit log rows older than 7 years are retained per financial record-keeping law) |
| Data portability | Export endpoint — returns all user data as JSON/CSV (decrypted for the requesting user only) |
| Data minimization | We collect only what is functionally necessary |
| No data selling | Enforced in ToS; technically impossible from our architecture |
| Breach notification | Sentry alerts + Better Stack uptime monitoring from day one |
| Data traceability | Append-only audit log on all financial mutations |

---

## 10. Observability Architecture

Observability is instrumented from day one — not added after the first production incident. The architecture follows the **three pillars**: logs, traces, metrics — with a fourth pillar: error tracking.

### Design Principles

1. **Vendor-neutral SDK.** All instrumentation uses OpenTelemetry. Changing the observability backend requires only an environment variable change — no code changes.
2. **No financial data in telemetry.** Logs, traces, and metrics must never contain amounts, account numbers, or PII. Use record IDs only.
3. **Structured logging only.** `pino` JSON output everywhere. No `console.log` in production.
4. **Sample traces, capture all errors.** 10% trace sampling in production; 100% error capture via Sentry.

### Telemetry Data Flow

```
API Server / Workers
  │
  ├── pino logger (JSON stdout)
  │     └── Railway log drain → Better Stack (logs + alerts)
  │
  ├── OpenTelemetry SDK
  │     ├── Traces → OTLP/HTTP → Grafana Tempo (Grafana Cloud free tier)
  │     └── Metrics → OTLP/HTTP → Grafana Mimir (Grafana Cloud free tier)
  │
  └── Sentry SDK
        └── Exceptions + performance → Sentry (free tier)

Better Stack
  └── Uptime monitors → /health + /ready endpoints
  └── Log-based alerts → error rate > 1%, auth failures spike
```

### Structured Logging (`pino`)

Fastify uses `pino` natively. Configure at server startup:

```typescript
const server = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? 'info',
    transport: process.env.NODE_ENV === 'development'
      ? { target: 'pino-pretty' }
      : undefined,
    serializers: {
      req: (req) => ({
        requestId: req.id,
        method: req.method,
        url: req.url,
        // Never log req.body — may contain passwords or financial data
      }),
      res: (res) => ({
        statusCode: res.statusCode,
      }),
    },
  },
})
```

**Request lifecycle log:**
```json
{ "level": "info", "requestId": "abc123", "userId": "uuid", "method": "POST",
  "route": "/transactions", "statusCode": 201, "durationMs": 34 }
```

**Business event log (import completed):**
```json
{ "level": "info", "requestId": "abc123", "userId": "uuid", "event": "import_completed",
  "batchId": "uuid", "source": "max", "imported": 47, "duplicates": 3,
  "matched": 12, "durationMs": 1840 }
```

### Distributed Tracing (OpenTelemetry)

Initialize in `api/src/instrumentation.ts` — this file must be imported before any other module:

```typescript
import { NodeSDK } from '@opentelemetry/sdk-node'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'

const sdk = new NodeSDK({
  serviceName: 'famileconomy-api',
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    headers: { Authorization: `Bearer ${process.env.OTEL_EXPORTER_OTLP_TOKEN}` },
  }),
  instrumentations: [getNodeAutoInstrumentations()],
})
sdk.start()
```

Auto-instrumentation covers: `fastify`, `pg`, `ioredis`, `undici` (HTTP client), `bullmq`.

**Manual spans for business-critical paths:**

```typescript
const { trace } = require('@opentelemetry/api')
const tracer = trace.getTracer('csv-import-worker')

async function processImportJob(job: Job) {
  return tracer.startActiveSpan('import.process', async (span) => {
    span.setAttributes({
      'import.source': job.data.source,
      'import.batch_id': job.data.batchId,
      'user.id': job.data.userId,   // ID only — never amounts or PII
    })
    try {
      const result = await runPipeline(job)
      span.setAttributes({ 'import.rows_imported': result.imported })
      return result
    } catch (err) {
      span.recordException(err as Error)
      span.setStatus({ code: SpanStatusCode.ERROR })
      throw err
    } finally {
      span.end()
    }
  })
}
```

### Metrics (OpenTelemetry)

```typescript
import { metrics } from '@opentelemetry/api'
const meter = metrics.getMeter('famileconomy-api')

// Counters
export const importJobsTotal = meter.createCounter('import_jobs_total', {
  description: 'Total import jobs by status',
})
export const authAttemptsTotal = meter.createCounter('auth_attempts_total', {
  description: 'Auth attempts by result',
})

// Histograms
export const httpDuration = meter.createHistogram('http_request_duration_ms', {
  description: 'HTTP request duration',
  unit: 'ms',
  advice: { explicitBucketBoundaries: [10, 25, 50, 100, 250, 500, 1000, 2500, 5000] },
})
export const dbQueryDuration = meter.createHistogram('db_query_duration_ms', {
  description: 'DB query duration',
  unit: 'ms',
})
```

### Health Endpoints

Every service exposes two mandatory endpoints:

```typescript
// Liveness — is the process alive?
fastify.get('/health', async () => ({ status: 'ok', uptime: process.uptime() }))

// Readiness — can the process serve traffic? (checks dependencies)
fastify.get('/ready', async (req, reply) => {
  const checks = await Promise.allSettled([
    prisma.$queryRaw`SELECT 1`,          // DB reachable
    redis.ping(),                         // Redis reachable
  ])
  const failed = checks.filter(c => c.status === 'rejected')
  if (failed.length > 0) {
    return reply.status(503).send({ status: 'not_ready', failed: failed.length })
  }
  return { status: 'ready' }
})
```

`/health` is used by Railway for container restarts. `/ready` is used for load balancer traffic routing. Neither endpoint logs at `info` level (too noisy) — use `debug` or suppress entirely.

### Tooling by Environment

| Environment | Logs | Traces | Metrics | Errors | Uptime |
|---|---|---|---|---|---|
| Development | pino-pretty (stdout) | Jaeger (Docker local) | — | Sentry (dev project) | — |
| Staging | Better Stack | Grafana Tempo | Grafana Mimir | Sentry | Better Stack |
| Production | Better Stack | Grafana Tempo | Grafana Mimir | Sentry | Better Stack |

**Local Jaeger for development:**
```yaml
# docker-compose.yml addition
jaeger:
  image: jaegertracing/all-in-one:latest
  ports:
    - "16686:16686"   # UI
    - "4318:4318"     # OTLP/HTTP
  environment:
    COLLECTOR_OTLP_ENABLED: "true"
```

Set `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318` locally to see traces in Jaeger UI at `http://localhost:16686`.

---

## 11. Import Pipeline Architecture

### Overview

The import pipeline is one of the most complex subsystems. It must handle:
- Multiple file formats (CSV, Excel — later PDF)
- Hebrew text encoding (Windows-1255 and UTF-8)
- Different column structures per bank
- Installment payment detection and grouping
- Duplicate prevention across multiple imports
- Matching to recurring expense definitions

### Pipeline Stages

```
Stage 1: Upload
  User selects file → Presigned R2 URL issued → File uploaded directly to R2
  (File never passes through API server — reduces server load + latency)

Stage 2: Detect
  POST /import/process → API reads file metadata → Detects bank source
  (by filename pattern, file structure, or user selection)
  → Enqueues BullMQ job: { fileKey, userId, source }

Stage 3: Parse
  Worker picks up job → Downloads file from R2
  → Runs appropriate parser (Max / Cal / Leumi / Mizrahi)
  → Normalizes to RawTransaction[]
  → Handles encoding (iconv-lite for Windows-1255)

Stage 4: Deduplicate
  For each RawTransaction:
    hash = SHA256(userId + date + amount + merchantRaw)
    Check hash against existing Transaction hashes
    If exists → mark as duplicate, skip
    If new → proceed

Stage 5: Enrich
  For each new RawTransaction:
    - Detect installment: parse "תשלום X מתוך Y" from description
    - Group installments: find or create installmentGroupId
    - Auto-categorize: merchant name → category (rule-based first, ML later)
    - Run matching engine: check against RecurringExpense patterns

Stage 6: Persist
  Batch insert all new transactions to DB
  Create ImportBatch record with stats
  Delete file from R2

Stage 7: Notify
  Push result to client (WebSocket or polling)
  Show summary: X imported, Y duplicates skipped, Z matched to recurring
```

### Parser Interface

Each bank parser implements this interface:

```typescript
// In /packages/parsers/src/base-parser.ts

interface BankParser {
  source: BankSource; // 'max' | 'cal' | 'leumi' | 'mizrahi'
  detect(buffer: Buffer): boolean; // Can this parser handle this file?
  parse(buffer: Buffer): Promise<RawTransaction[]>;
}

interface RawTransaction {
  date: string;          // DD/MM/YYYY — parsed to Date in Stage 3
  merchantRaw: string;   // Exact string from bank file
  amount: number;        // Always positive. Negative = credit/refund
  currency: string;      // 'ILS' | 'USD' | 'EUR'
  description?: string;  // Additional description column if present
  installmentText?: string; // Raw installment text e.g. "2/6"
  transactionType?: string; // Bank-specific type field
}
```

### Deduplication Strategy

Duplicate prevention uses a **content hash**, not a timestamp or ID (bank IDs are unreliable and not always present).

```typescript
function buildTransactionHash(t: RawTransaction, userId: string): string {
  // Normalize amount to avoid float comparison issues
  const normalizedAmount = Math.round(t.amount * 100);
  // Normalize merchant: lowercase, remove extra spaces
  const normalizedMerchant = t.merchantRaw.toLowerCase().trim();
  const dateStr = parseDate(t.date).toISOString().split('T')[0];

  return SHA256(`${userId}:${dateStr}:${normalizedAmount}:${normalizedMerchant}`);
}
```

**Known edge case:** The same charge may appear in two consecutive month exports (e.g., a charge at month end). The date is part of the hash, so this is handled correctly — same date = same hash = duplicate.

**Known edge case:** Installment payments appear once per month with identical merchant names but sequential installment numbers. The installment index must be included in the hash for these:

```typescript
if (t.installmentText) {
  return SHA256(`${userId}:${dateStr}:${normalizedAmount}:${normalizedMerchant}:${t.installmentText}`);
}
```

---

## 12. Data Flow Diagrams

### Flow 1: Monthly Dashboard Load

```
User opens app
  → Zustand store checks: is local DB populated for current month?
  → YES: Render from local DB immediately (zero network latency)
    → Background: Trigger sync pull if last sync > 15 min
  → NO: Show loading state → Pull from cloud → Populate local DB → Render
```

### Flow 2: CSV Import (Happy Path)

```
User taps "ייבוא כרטיס אשראי"
  → Selects file → App requests presigned URL from API
  → Uploads directly to R2 (API not in the data path)
  → Calls POST /import/process
  → Worker job created → Shows "מעבד..." status
  → [Background] Parser runs → Dedup → Enrich → Match → Persist
  → WebSocket push to client: { imported: 47, duplicates: 3, matched: 12 }
  → Dashboard reloads (reactive, automatic via WatermelonDB observer)
```

### Flow 3: Recurring Expense Matching

```
Recurring expense defined: {
  name: "חשמל",
  merchantMatchPattern: "חברת החשמל",
  expectedAmount: 680,
  amountTolerance: 0.15, // 15%
  dayOfMonth: 15
}

New transaction imported: {
  merchantRaw: "חברת החשמל הישראלית",
  amount: 712,
  date: "17/05/2024"
}

Matcher checks:
  1. merchantRaw.includes("חברת החשמל") → TRUE
  2. date within ±5 days of dayOfMonth(15) → day 17, diff = 2 → TRUE
  3. amount(712) within 15% of expected(680) → 712/680 = 1.047 → 4.7% → TRUE
  4. Result: MATCHED ✓

  Amount diff = 4.7% (within tolerance) → no alert
  If diff > 15% → create Alert { type: 'AMOUNT_CHANGED', recurringId, expected: 680, actual: 712 }
```

---

## 13. Infrastructure & Deployment

### MVP Infrastructure (Solo Developer Friendly)

| Service | Provider | Rationale |
|---|---|---|
| API hosting | Railway | Zero DevOps, auto-deploy from Git, scales to multiple instances |
| PostgreSQL | Railway (managed) | Automated backups, connection pooling, no DBA needed |
| Redis | Railway (managed) | BullMQ + caching + rate limiting |
| File storage | Cloudflare R2 | S3-compatible, zero egress fees, generous free tier |
| CDN | Cloudflare | Free tier sufficient for MVP |
| Mobile builds | Expo EAS Build | Managed iOS/Android builds without local Xcode/Android Studio |
| Web hosting | Vercel | Zero-config Next.js deployment, global CDN |
| Monitoring | Better Stack (Logtail) | Logs + uptime monitoring, generous free tier |
| Error tracking | Sentry | Free for small volumes, critical for production quality |

### Environment Strategy

```
development  → Local PostgreSQL (Docker) + Local Redis + Mock R2
staging      → Railway project (staging) — same infra as prod, smaller
production   → Railway project (prod) + Vercel (web) + Expo EAS (mobile)
```

### CI/CD Pipeline

```
Git push to main branch
  → GitHub Actions triggered
  → Turborepo: lint + typecheck + test (all packages in parallel)
  → If all pass:
    → API: Railway auto-deploy (zero-downtime rolling deploy)
    → Web: Vercel auto-deploy
    → Mobile: EAS Update (OTA JS bundle update — no app store review)
  → Sentry: new release tagged
  → Slack/Discord notification (build status)
```

---

## 14. Scalability Model

### How This Architecture Scales

| Component | Scale Strategy | When Needed |
|---|---|---|
| API server | Horizontal scale (add instances) | > 500 concurrent users |
| PostgreSQL | Read replicas for reporting queries | > 5,000 users |
| Redis | Redis Cluster | > 10,000 users |
| BullMQ workers | Add worker processes | Import queue depth > 30s wait |
| File storage | R2 scales automatically | Never a bottleneck |

### Database Indexing Strategy

Critical indexes from day one (do not wait until slow):

```sql
-- All queries are scoped to userId first
CREATE INDEX idx_transactions_user_month ON transactions(user_id, year, month);
CREATE INDEX idx_transactions_hash ON transactions(hash); -- dedup lookups
CREATE INDEX idx_transactions_recurring ON transactions(matched_recurring_id);
CREATE INDEX idx_recurring_user ON recurring_expenses(user_id, is_active);
CREATE INDEX idx_import_batch_user ON import_batches(user_id, imported_at DESC);
```

### Data Volume Estimates

A typical family imports ~100-200 transactions/month. At 1,000 users:
- ~150,000 transactions/month added
- ~5M total transactions after 3 years per 1,000 users

PostgreSQL handles 100M+ rows comfortably with proper indexing. This is not a scale concern for the foreseeable future.

---

## 15. MVP Boundaries

### What Is In MVP (Build This, Nothing Else)

**Auth**
- [ ] Register with email + password
- [ ] Login / Logout
- [ ] JWT + Refresh token

**Income**
- [ ] Add monthly salary (manual entry)
- [ ] Edit / delete income entries

**Transactions**
- [ ] Manual expense entry (amount, merchant, category, date, notes)
- [ ] CSV import: Max (מקס) — first parser to build
- [ ] CSV import: Cal (כאל) — second parser
- [ ] Duplicate detection on import
- [ ] Installment grouping (תשלומים)
- [ ] Basic auto-categorization (rule-based, not ML)

**Recurring Expenses (תשלומים קבועים)**
- [ ] Define recurring expense (name, amount, merchant pattern, day of month)
- [ ] Matching engine runs on import
- [ ] Dashboard shows שולם / צפוי status per recurring item

**Dashboard (תמונת מצב)**
- [ ] Monthly income KPI
- [ ] Monthly expenses KPI
- [ ] Monthly balance KPI
- [ ] Safe-to-spend KPI
- [ ] Planned vs. actual for each KPI
- [ ] Category breakdown (donut chart)
- [ ] Month-end forecast (line chart)
- [ ] Recent transactions list
- [ ] Recurring payments status list
- [ ] 3-month historical comparison

**Settings**
- [ ] Profile management
- [ ] Change password

### What Is NOT In MVP (Explicitly Deferred)

- Bank Leumi + Mizrahi parsers (Phase 2)
- Cloud sync (Phase 2)
- Reports screen (Phase 2)
- Goals / יעדים screen (Phase 3)
- Multi-card management screen (Phase 2)
- Spouse / shared family mode (Phase 3)
- AI categorization (Phase 3)
- Multi-currency support (Phase 2)
- PDF import (Phase 3)
- Push notifications (Phase 2)
- Data export (Phase 2)

---

## 16. Open Questions & Decisions Log

| # | Question | Status | Decision |
|---|---|---|---|
| 1 | Monetization model | OPEN | Freemium likely, not yet decided |
| 2 | Open banking integration (Israeli APIs) | DEFERRED | No mature Israeli open banking API exists yet |
| 3 | Spouse mode data model | DEFERRED | Phase 3 — requires shared workspace concept |
| 4 | PDF import feasibility | DEFERRED | Requires OCR — significant complexity |
| 5 | Offline-first conflict resolution | DECIDED | LWW with timestamp; revisit if user reports data loss |
| 6 | App name | OPEN | Placeholder: "קופת המשפחה" |
| 7 | App Store distribution | OPEN | TestFlight for beta, public later |
| 8 | GDPR applicability | DECIDED | Israeli Privacy Law applies; GDPR only if EU users targeted |
| 9 | Max CSV encoding | PENDING | Verify with real sample — Windows-1255 or UTF-8? |
| 10 | Cal installment column format | PENDING | Verify with real Cal CSV sample |

---

## Document Change Log

| Version | Date | Changes |
|---|---|---|
| 1.0 | April 2026 | Initial draft — pre-development architecture session |

---

*Next Document: **02-data-model-and-schema.md** — Every table, every column, every relationship, every edge case.*
