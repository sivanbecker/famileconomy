# Famileconomy

A personal finance management app for families — tracking income, expenses, budgets, savings goals, and shared accounts. Supports Hebrew (RTL) and English.

## Tech Stack

- **Web:** Next.js 16, TypeScript, Tailwind CSS, React Query, Zustand
- **Mobile:** Expo (React Native), WatermelonDB with SQLCipher
- **API:** Node.js, Fastify, TypeScript
- **Database:** PostgreSQL with Row Level Security
- **Queue:** BullMQ for async imports
- **Monorepo:** Turborepo with shared packages (`@famileconomy/types`, `@famileconomy/ui`, `@famileconomy/utils`)

---

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Docker + Docker Compose (for PostgreSQL + Redis)

### Setup

```bash
# 1. Start Docker containers
docker-compose up -d

# 2. Install dependencies
npm install

# 3. Apply database migrations and generate prisma types
npm run db:setup --workspace=api

# 4. Start dev servers
npx turbo dev --filter='@famileconomy/web' --filter='@famileconomy/api'
```

This starts:

- **Web UI** → http://localhost:3000
- **API** → http://localhost:3001
- **PostgreSQL** → localhost:5432
- **Redis** → localhost:6379

---

## Why Only Web + API?

`npm run dev` tries to start the mobile app (Expo), which fails due to a nativewind/react-native version mismatch. For now, we skip mobile dev and focus on web + API. Mobile will be fixed in Phase 8.

---

## Development

### Register & Login

1. Open http://localhost:3000
2. Click "Register" and create a new account
3. Login with those credentials

### Import CSV Files

1. Dashboard → "Import" tab
2. Upload MAX (מקס) or CAL (כאל) CSV exports
3. Transactions auto-group by card/account and deduplicate by file hash + row hash

### Development Scripts

Convert and rename XLSX files locally:

```bash
# Convert batch of XLSX to CSV using local folder structure config
uv run scripts/xlsx-to-csv.py --provider CAL --year 2026 --batch

# Rename XLSX files after parsing
uv run scripts/xlsx-rename.py --provider MAX --year 2026 --batch
```

### Running Local Dev Server

```bash
# Start web + API servers
npx turbo dev --filter='@famileconomy/web' --filter='@famileconomy/api'
```

### Google Drive Import (Phase 8)

Coming soon: connect Google Drive to import CSVs directly from folders.

---

## Clear Database

To reset transactions and re-import (keeps user accounts):

```sql
TRUNCATE TABLE audit_log, transactions, recurring_matches, recurring_expenses, import_batches, accounts, sessions CASCADE;
```

Or via command line:

```bash
psql -h localhost -U famileconomy -d famileconomy \
  -c "TRUNCATE TABLE audit_log, transactions, recurring_matches, recurring_expenses, import_batches, accounts, sessions CASCADE;"
```

---

## Project Status

### Implemented ✅

**Phase 5:** Database schema, auth (login/register, JWT, rotating refresh tokens), Row Level Security

**Phase 6:** Observability (Pino logging, OpenTelemetry, Sentry)

**Phase 7a:** CSV parsers (MAX, CAL, installments), row-level + batch-level dedup, import API

**Phase 7b:**

- Auth pages (login, register, logout)
- Dashboard (KPI cards, month navigator, category chart)
- Transactions list with search/filter/sort
- Expenses anomaly detection
- Google Drive OAuth routes + async job queue

**Phase 7c:** Google Drive BullMQ worker (folder walk, CSV download, batch import)

### In Progress 🔄

**Phase 8:**

- Frontend hooks: `useGoogleDriveStatus()`, `useGoogleDriveImport()`
- DriveImportModal component (3-panel: connect → pick folder/file → progress)
- Dashboard integration

### Not Started ⏳

**Phase 7c:** Recurring expense matching engine

**Phase 7e:** Safe-to-Spend formula + month-end forecast

**Phase 8:** Mobile app (Expo, WatermelonDB, local-first sync)

**Phase 9:** E2E tests (Playwright), production deploy (Railway API, Vercel web)

---

## Code Quality

```bash
# Run all checks
npm run test      # unit tests
npm run lint      # ESLint
npm run typecheck # TypeScript
npm run format:check  # Prettier
```

All commits run pre-commit hooks (lint + format) and pre-push (typecheck + security scan).

---

## Folder Structure

```
apps/
  api/              # Fastify server, database migrations, services
  web/              # Next.js frontend
  mobile/           # Expo app (Phase 8+)

packages/
  types/            # Shared TypeScript types
  ui/               # Shared UI components (shadcn-based)
  utils/            # Financial math, formatters, helpers

docs/
  ROADMAP.md        # Phase-by-phase progress
  GOOGLE_OAUTH_SETUP.md  # OAuth config
```

---

## Environment Variables

Copy `.env.example` → `.env` in `apps/api` and `apps/web` and fill in:

- `DATABASE_URL` — PostgreSQL connection
- `REDIS_HOST`, `REDIS_PORT` — Redis connection
- `JWT_SECRET` — Session signing key
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` — OAuth
- `SENTRY_DSN` — Error tracking

---

## Resources

- [Roadmap](docs/ROADMAP.md) — Phase-by-phase breakdown
- [Google OAuth Setup](docs/GOOGLE_OAUTH_SETUP.md) — How to configure OAuth
- [CLAUDE.md](CLAUDE.md) — Development guidelines (security, financial math, i18n, TDD)

---

## Contributing

1. Create a branch: `git checkout -b feat/your-feature`
2. Follow TDD: write tests first, then implementation
3. All tests must pass: `npm run test`
4. Format + lint before push: `npm run format && npm run lint`
5. Open a PR and merge once CI is green

---

## License

Private (not yet decided).
