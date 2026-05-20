# Octane11 Technical Challenge — Implementation Plan

## Context

Solo deliverable for Octane11's Full-Stack technical challenge (3h budget). Build a minimal end-to-end slice: a semantic-layer-backed query builder, an Express API that exposes it, and a single React table widget — plus CI. The repo currently has only `docs/initial-problem.md`, `data/events.csv` (500 rows), and a starter `src/semantic-layer.ts` (will be discarded/relocated).

Goal: clean, defensible code that demonstrates judgement on a real production pattern (semantic layer → AST → SQL → typed HTTP → typed UI). Optimise for **interview talking points** over feature breadth.

---

## Tech decisions (confirmed)

- **Monorepo**: pnpm workspaces. Packages: `shared/`, `api/`, `web/`. Plus `docs/`, `data/`.
- **Language**: TypeScript everywhere, ESM, Node 20.
- **DB**: SQLite via `better-sqlite3` (sync, no ORM). DB file committed at `data/events.db`.
- **Validation**: Zod (type-first — `z.ZodType<T>`, never `z.infer`).
- **Lint/format**: ESLint (flat config) + Prettier.
- **Tests**: Vitest, backend only (query builder).
- **Frontend**: Vite + React + shadcn/ui + TanStack Query + TanStack Table + nuqs.
- **CI**: GitHub Actions, single job with steps (lint, typecheck, test, docker build, web build) using pnpm cache.

---

## Repo layout

```
docs/                       initial-problem.md (+ existing)
data/
  events.csv                seed source (existing)
  events.db                 committed pre-seeded SQLite
shared/
  src/
    semantic.ts             keys + metadata (label, kind) — NO SQL
    schemas.ts              Zod schemas, derived from semantic keys
    types.ts                DataRequest, DataResponse, QueryError
    errors.ts               ValidationError / NotFoundError classes
    index.ts                barrel
  package.json
  tsconfig.json
api/
  src/
    semantic-sql.ts         SQL fragments per metric/dimension (server-only)
    query-builder/
      ast.ts                buildAst(request, semantic) → QueryAst
      compile.ts            compile(ast) → { sql, params }
      index.ts              executeQuery(request, db) — top-level
    db.ts                   better-sqlite3 singleton
    seed.ts                 CSV → events.db (CLI: `pnpm seed`)
    routes.ts               POST /query, GET /masterdata
    middleware.ts           error handler
    server.ts               express bootstrap (helmet, cors, rate-limit, json)
    index.ts                entry — starts server
  test/
    query-builder.test.ts   AST + compile + execution
  Dockerfile
  .env / .env.example       PORT, DB_PATH, CORS_ORIGIN
  package.json, tsconfig.json
web/
  src/
    App.tsx                 layout + Header + table
    components/
      Header.tsx            Octane11 logo + title
      CampaignAnalyticsTable.tsx   the single required component
    lib/
      api.ts                fetch wrapper (typed via shared)
      query-state.ts        nuqs parsers built from shared Zod schemas
  index.html, vite.config.ts, tsconfig.json
  .env / .env.example       VITE_API_URL
.github/workflows/ci.yml
package.json                root: workspaces, scripts
pnpm-workspace.yaml
tsconfig.base.json          shared compiler opts
.eslintrc / eslint.config.js, .prettierrc
README.md
```

---

## Semantic layer (with `kind`)

`shared/src/semantic.ts` — public metadata only:
```ts
export type DimensionKind = 'string' | 'date';
export type MetricKind = 'count' | 'ratio';

export const dimensions = {
  campaign: { label: 'Campaign', kind: 'string' },
  channel:  { label: 'Channel',  kind: 'string' },
  account:  { label: 'Account',  kind: 'string' },
  date:     { label: 'Date',     kind: 'date'   },
} as const satisfies Record<string, { label: string; kind: DimensionKind }>;

export const metrics = {
  impressions:     { label: 'Impressions',         kind: 'count' },
  clicks:          { label: 'Clicks',              kind: 'count' },
  conversions:     { label: 'Conversions',         kind: 'count' },
  ctr:             { label: 'Click-Through Rate',  kind: 'ratio' },
  conversion_rate: { label: 'Conversion Rate',     kind: 'ratio' },
} as const satisfies Record<string, { label: string; kind: MetricKind }>;

export type DimensionKey = keyof typeof dimensions;
export type MetricKey    = keyof typeof metrics;
```

`api/src/semantic-sql.ts` — server-only SQL fragments keyed by the same identifiers (from the provided `src/semantic-layer.ts`).

**Why split:** the SQL never leaves the server; the frontend only needs labels & keys. New metric = add to both files; everything else (Zod, types, UI dropdowns) flows automatically.

---

## DataRequest contract (`shared/src/types.ts`)

```ts
export type Operator = 'eq' | 'in' | 'gte' | 'lte';

export type Filter = {
  dimension: DimensionKey;
  operator: Operator;
  value: string | string[];
};

export type OrderBy = {
  key: MetricKey | DimensionKey;
  direction: 'asc' | 'desc';
};

export type DataRequest = {
  metrics: MetricKey[];
  dimensions?: DimensionKey[];
  filters?: Filter[];
  orderBy?: OrderBy[];
  limit?: number;   // default 100, max 1000
  offset?: number;  // default 0
};

export type DataRow = Record<string, string | number | null>;

export type DataResponse = {
  rows: DataRow[];
  columns: { key: string; label: string; kind: MetricKind | DimensionKind }[];
};
```

Zod schemas in `shared/src/schemas.ts` typed as `z.ZodType<DataRequest>`, with enum keys built from `Object.keys(metrics)`/`Object.keys(dimensions)` so adding a new metric automatically widens the API surface.

**Operator validation rules** (enforced in `buildAst`):
- `string` dim: `eq | in`
- `date`   dim: `eq | gte | lte` (value must parse as ISO date)
- `value` shape matches operator (`in` ⇒ array, others ⇒ scalar)

---

## Query builder — two-step AST + compile

**Step 1 — `buildAst(req, semantic)`** validates semantics (unknown keys, operator/kind compatibility, limit bounds) and produces:
```ts
type QueryAst = {
  select: ({ kind: 'metric' | 'dimension'; key: string; alias: string })[];
  where:  ({ key: string; op: Operator; value: string | string[] })[];
  groupBy: string[];           // dimension keys
  orderBy: { alias: string; dir: 'asc' | 'desc' }[];
  limit: number;
  offset: number;
};
```
Returns `Result<QueryAst, ValidationError>` (no throws on user-input errors → mapped to 400 by middleware).

**Step 2 — `compile(ast, sqlMap)`** walks the AST and produces:
```ts
{ sql: string, params: unknown[] }
```
- Identifiers (column names, SQL fragments) come **only** from `sqlMap` keyed by validated keys → no string interpolation of user input.
- Values **always** flow through `?` placeholders → SQLite parameterised query.
- `in` becomes `(?, ?, …)` expanded from the validated array.
- Alias columns by their semantic key for stable JSON keys.

**Execution**: `db.prepare(sql).all(...params)`. Result rows are returned as-is plus a `columns` descriptor (label + kind) derived from the AST — drives the table headers on the UI.

---

## Backend wiring

- `server.ts`: helmet, cors (origin from env), express-rate-limit (60/min), `express.json({ limit: '64kb' })`.
- `POST /query`: parse body with Zod → `buildAst` → `compile` → execute → respond. Errors funnelled through `middleware.ts` (`ValidationError → 400`, other → 500 with generic message; never leak SQL).
- `GET /masterdata`: returns `{ metrics, dimensions, campaigns: string[], accounts: string[], channels: string[] }` — `campaigns/accounts/channels` are `SELECT DISTINCT` from `events`. Feeds the UI dropdowns.
- `db.ts`: opens `DB_PATH` read-only (the API never writes — only the seed CLI does). Singleton.
- `.env.example`: `PORT=3001`, `DB_PATH=../data/events.db`, `CORS_ORIGIN=http://localhost:5173`.

---

## Seed script (`api/src/seed.ts`)

CLI: `pnpm --filter @octane11/api seed`.
1. Open/create `data/events.db`.
2. `DROP TABLE IF EXISTS events; CREATE TABLE events(...)`.
3. Stream `data/events.csv` row by row (no dependency — small file, native split). Parameterised `INSERT` inside a transaction.
4. Index: `CREATE INDEX idx_events_campaign ON events(campaign_id); idx_events_account ON events(account_id); idx_events_occurred_at ON events(occurred_at);`.
5. Print row count.

DB committed; CI does **not** reseed.

---

## Unit tests (`api/test/query-builder.test.ts`)

Scope (per user constraint — backend query builder only):

1. **AST validation**
   - Unknown metric/dimension key → `ValidationError`.
   - `gte` on string dim → `ValidationError`.
   - `in` with scalar value → `ValidationError`.
   - `limit > 1000` → clamped or rejected (decide: reject).
2. **Compile correctness**
   - Snapshot SQL for a representative request (metrics + group by + filter + order by + limit/offset).
   - Verify `params` array contents and length.
   - `in` expands placeholders correctly.
3. **End-to-end execution against the real seeded DB** (using `data/events.db`):
   - CTR result matches a hand-computed expectation for one campaign.
   - Grouping by channel returns one row per channel.
   - Filter `campaign eq 'campaign_abc'` narrows rows correctly.

---

## Frontend (`web/src/components/CampaignAnalyticsTable.tsx`)

Single page:
- `<Header>` — Octane11 wordmark (text logo + small svg or fetch from their site as a static asset, no copyrighted assets committed).
- Toolbar (shadcn `Select` × 3):
  - **Group by**: `campaign | account | channel`
  - **Campaign filter**: from `masterdata.campaigns` (`All` + each id)
  - **Account filter**: from `masterdata.accounts`
- State synced to URL via `nuqs` parsers built from the shared Zod schemas (`useQueryStates`).
- TanStack Query: one `useQuery(['masterdata'])`, one `useQuery(['query', state])` rebuilding the `DataRequest` from URL state. `keepPreviousData` for smooth re-renders.
- TanStack Table: columns derived from `response.columns` (label from semantic, formatting from `kind`: ratios → percentage to 2 dp, counts → integer).
- Loading + error states minimal but present.

Shadcn: install only `button`, `select`, `table`, `card` (no kitchen sink).

---

## CI (`.github/workflows/ci.yml`)

Single workflow on `pull_request` and `push: main`:

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - checkout
      - setup pnpm (cache)
      - setup node 20
      - pnpm install --frozen-lockfile
      - pnpm -r lint
      - pnpm -r typecheck     # tsc --noEmit per package
      - pnpm --filter @octane11/api test
      - pnpm --filter @octane11/web build       # static asset
      - docker build api      # no push
```

Start sequential; only split if total runtime > 3 min.

---

## Dockerfile (api)

Multi-stage:
1. `node:20-alpine` builder — install workspace deps, `pnpm --filter @octane11/api build`, prune dev deps.
2. `node:20-alpine` runtime — copy `dist/`, `node_modules`, `data/events.db`. `USER node`, `EXPOSE 3001`, `CMD ["node","dist/index.js"]`.

---

## Security checks (call out during build)

- All user values bound via `?` params — never interpolated.
- Identifiers (column/sql) resolved through the semantic map, never from request.
- `helmet`, CORS pinned to `CORS_ORIGIN`, rate-limit, JSON body size cap.
- Error responses never leak SQL/stack — only `code` + `message`.
- `LIMIT` capped server-side regardless of client value.

---

## README outline (filled at end)

```
## Overview
   Short description of libs + components.
## Seeding the DB
   pnpm install && pnpm --filter @octane11/api seed
## Running the app
   pnpm dev (concurrently api + web), pnpm build, pnpm test.
## Decisions made           (bullets I'll dictate)
## Trade-offs accepted      (bullets I'll dictate)
## Proposed improvements    (bullets I'll dictate)
```

---

## Critical files to be created

- `pnpm-workspace.yaml`, root `package.json`, `tsconfig.base.json`
- `shared/src/{semantic,types,schemas,errors,index}.ts`
- `api/src/{server,index,routes,middleware,db,seed,semantic-sql}.ts`
- `api/src/query-builder/{ast,compile,index}.ts`
- `api/test/query-builder.test.ts`
- `api/Dockerfile`, `api/.env.example`
- `web/src/App.tsx`, `web/src/components/{Header,CampaignAnalyticsTable}.tsx`
- `web/src/lib/{api,query-state}.ts`
- `web/.env.example`, `web/vite.config.ts`
- `.github/workflows/ci.yml`
- `.eslintrc`, `.prettierrc`, `README.md`

Files removed/relocated:
- `src/semantic-layer.ts` → split into `shared/src/semantic.ts` (metadata) + `api/src/semantic-sql.ts` (SQL).

---

## Verification (end-to-end)

1. `pnpm install` from a clean clone.
2. `pnpm --filter @octane11/api seed` — confirm 500 rows.
3. `pnpm dev` — api on 3001, web on 5173.
4. `curl -X POST localhost:3001/query -H 'content-type: application/json' -d '{"metrics":["ctr","conversion_rate"],"dimensions":["channel"]}'` returns 4 rows.
5. Browse to `localhost:5173`, change group-by/filters, observe URL updating and table re-querying.
6. `pnpm -r lint && pnpm -r typecheck && pnpm --filter @octane11/api test` — all green.
7. `docker build -t octane11-api api/` — succeeds.

---

## Execution order (matches user priorities)

1. **Scaffold** — workspace, configs, dependencies, empty package skeletons.
2. **Seed** — `seed.ts` + run it once → commit `data/events.db`.
3. **API + query builder** — semantic, AST, compile, routes, middleware.
4. **Tests** — Vitest suite for query builder.
5. **Web** — masterdata + table widget wired to real API.
6. **CI + Docker + README**.
