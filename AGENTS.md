# CLAUDE.md

Context for AI assistants working in this repo. The full implementation plan lives in [`docs/initial-plan.md`](docs/initial-plan.md); the original challenge brief in [`docs/initial-problem.md`](docs/initial-problem.md).

---

## Project

Octane11 Full-Stack technical challenge (~3h budget). End-to-end slice:
**semantic layer → AST → SQL → typed Express API → typed React table**. Optimise for **interview talking points**, not feature breadth.

---

## Working agreement

- All code, comments, identifiers, commit messages, docs → **English**, even when the user writes in Spanish.
- Responses to the user → short, direct, no filler.
- Flag insecure code / bad practices the moment they appear (SQL injection, leaked stack traces, missing input bounds, etc.) — don't wait.
- **Minimalist code**: no unrequested abstractions, no speculative boilerplate, minimum files. The user adds complexity, not the assistant.
- Unit tests only on the **backend query builder**. No frontend tests.
- Code must be **well documented** — comments explain the *why*, not the *what*.

---

## Architecture (locked)

- **Monorepo**: pnpm workspaces. Packages: `shared/`, `api/`, `web/`. Plus `docs/`, `data/`.
- **Language**: TypeScript, ESM, Node 20.
- **DB**: SQLite via `better-sqlite3`, no ORM. File committed at `data/events.db`.
- **Validation**: Zod, **type-first** (`z.ZodType<T>`, never `z.infer`).
- **Lint/format**: ESLint flat config + Prettier.
- **Tests**: Vitest (backend only).
- **Frontend**: Vite + React + shadcn/ui + TanStack Query + TanStack Table + nuqs.
- **CI**: GitHub Actions, single job, pnpm cache. Steps: lint, typecheck, test, web build, docker build (no push).

---

## Layering rules

- `shared/` holds the **source of truth for types** + Zod schemas + error classes + semantic-layer **metadata** (label, kind). **No SQL.**
- `api/` holds runtime: DB, query builder (AST + compile), routes, middleware, **and the SQL fragments** for each metric/dimension (`semantic-sql.ts`).
- `web/` consumes only types from `shared`, never imports from `api`.
- Each package has its own `.env` + `.env.example` (the example is committed).

---

## Semantic layer

Both metrics and dimensions carry a `kind`:

- `dimensions[k].kind: 'string' | 'date'` — drives operator validation (`gte/lte` only on `date`).
- `metrics[k].kind: 'count' | 'ratio'` — drives UI formatting (counts → integer, ratios → percent).

Adding a new metric/dimension = update `shared/src/semantic.ts` + `api/src/semantic-sql.ts`. Zod schemas, API surface, and UI dropdowns derive from there.

---

## Query builder (two-step, security-critical)

1. **`buildAst(request, semantic)`** — validates keys, operator/kind compatibility, limit bounds. Returns `Result<QueryAst, ValidationError>`. Never throws on user input.
2. **`compile(ast, sqlMap)`** — returns `{ sql, params }`.
   - Identifiers (column names, SQL fragments) resolved **only** through `sqlMap` keyed by validated keys.
   - All user values flow through `?` placeholders. **Never** interpolate user input into SQL.
   - `in` expands to `(?, ?, …)` from the validated array.

Supports `SELECT`, `WHERE`, `GROUP BY`, `ORDER BY`, `LIMIT`, `OFFSET`.

---

## Backend endpoints

- `POST /query` — body validated by Zod → `buildAst` → `compile` → execute.
- `GET /masterdata` — returns semantic metadata + distinct `campaigns / accounts / channels` for UI dropdowns.

Middleware: `helmet`, CORS (env-pinned), `express-rate-limit` (60/min), `express.json({ limit: '64kb' })`, central error handler. `ValidationError → 400`; other errors → generic 500 (never leak SQL/stack).

`db.ts` opens `DB_PATH` **read-only** (the API never writes — only the seed CLI does).

---

## Seeding

`pnpm --filter @octane11/api seed` reads `data/events.csv`, recreates the `events` table with indexes on `campaign_id`, `account_id`, `occurred_at`, and writes `data/events.db`. The DB file is committed; CI does **not** reseed.

---

## Frontend

Single component `CampaignAnalyticsTable.tsx` + `Header` (Octane11 wordmark).

- Filters: campaign, account. Grouping: campaign | account | channel.
- URL state via `nuqs` parsers built from the shared Zod schemas.
- TanStack Query: one query for `/masterdata`, one for `/query` keyed by URL state.
- TanStack Table: columns derived from `response.columns`; formatting driven by `kind`.

---

## Execution order (do not reorder)

1. Scaffold workspace + configs + deps.
2. Seed DB.
3. API + query builder.
4. Unit tests (query builder).
5. Frontend + integration.
6. CI + Docker + README.

---

## README sections (final deliverable)

1. Overview (libs + components).
2. How to seed the DB.
3. How to run the app.
4. Decisions made — bullet points dictated by the user.
5. Trade-offs accepted — bullet points dictated by the user.
6. Proposed improvements — bullet points dictated by the user.
