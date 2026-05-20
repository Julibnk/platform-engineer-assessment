# Octane11 Analytics

Campaign analytics platform built as a Full-Stack technical challenge. Translates semantic metric/dimension definitions into efficient SQL queries, exposes them through a typed API, and renders results in an interactive table.

---

## Stack

**Monorepo** — pnpm workspaces with three packages:

| Package | Role |
|---------|------|
| `shared` | Source of truth for types, Zod schemas, semantic layer metadata (labels, kinds), and error classes |
| `api` | Express server — semantic SQL fragments, two-step query builder (AST → compile), SQLite execution |
| `web` | Vite + React — TanStack Query + TanStack Table, nuqs URL state, shadcn/ui components |

**Backend**

| Library | Purpose |
|---------|---------|
| `express` | HTTP server |
| `better-sqlite3` | Synchronous SQLite driver |
| `zod` | Request validation at the HTTP boundary |
| `helmet` · `cors` · `express-rate-limit` | Security baseline |
| `vitest` | Unit test runner |

**Frontend**

| Library | Purpose |
|---------|---------|
| `@tanstack/react-query` | Server state, caching and re-fetching |
| `@tanstack/react-table` | Headless table with dynamic columns |
| `nuqs` | Filter/groupBy state synced to the URL |
| `shadcn/ui` + `tailwindcss` | UI primitives |

---

## Seeding the DB

The pre-seeded `data/events.db` is committed — no setup needed on clone.

To regenerate it from `data/events.csv`:

```bash
pnpm install
pnpm --filter @octane11/api seed
```

---

## Running the app

```bash
pnpm install
pnpm dev          # api on :3001, web on :5173
```

Other commands:

```bash
pnpm build        # build all packages
pnpm test         # query builder unit tests
pnpm -r lint      # lint all packages
pnpm -r typecheck # typecheck all packages
```

Copy env files before first run:

```bash
cp api/.env.example api/.env
cp web/.env.example web/.env
```

**Docker:**

```bash
docker build -f api/Dockerfile -t octane11-api .
docker run -p 3001:3001 octane11-api
```

---

## Decisions made

- pnpm monorepo (shared / api / web) — enforces the boundary between public types and server-only SQL
- Two-step query builder (AST → compile) — separates semantic validation from SQL generation; each step is independently testable
- Semantic layer split — metadata (label, kind) in `shared`, SQL fragments in `api` only; frontend never sees raw SQL
- AST nodes typed with literal key unions (`MetricKey | DimensionKey`) — compiler proves no unvalidated string reaches a SQL identifier position
- `ValidationError` with `field` path — single error class with structured payload for precise client-side error targeting
- SQLite committed to repo — zero setup on clone; maps to BigQuery/Snowflake by swapping the driver and adapting SQL dialect
- Read-only DB connection in API — defence in depth; API never writes post-seed
- `GET /masterdata` endpoint — single call gives the frontend all semantic metadata and distinct filter values (campaigns, accounts, channels); avoids hardcoding labels or enums in the client
- TypeScript types as source of truth — Zod validates at the wire boundary, types are never inferred from schemas

---

## Trade-offs accepted

- SQLite over a real warehouse — query builder is warehouse-agnostic, dialect differences isolated to `semantic-sql.ts` and `compile.ts`
- No ORM — skipped for simplicity and time; raw SQL fits naturally with the query builder pattern
- DB committed to repo and baked into the Docker image — convenient for demo and CI; not suitable for production
- CI pipeline kept simple — single sequential job given the 3h time constraint
- CI actions on `@v4` (Node.js 20 runtime) — GitHub forces Node.js 24 from June 2026; fix is `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true` or upgrading to `@v5`
- Distinct filter values in `/masterdata` are hardcoded queries (`SELECT DISTINCT`) — works for the current single-table schema but does not scale to a multi-table semantic layer where dimensions may live in separate tables
