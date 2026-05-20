# Full Stack Engineer — Technical Challenge

## Overview

This challenge is designed to be completed in **2–3 hours**. We're not looking for a production-ready system — we're looking for clean, thoughtful code and clear decision-making. There are no trick questions. Use any tools and resources you normally would, including AI assistants.

After submitting, we'll have a 45–60 minute follow-up conversation where we'll walk through your solution together, ask about the decisions you made, and explore some extensions.

---

## Background

Octane11 is a B2B marketing and sales analytics platform. A core part of the product is querying large volumes of campaign engagement data — stored in data warehouses like BigQuery — and exposing meaningful metrics to users through APIs and dashboards.

The platform layer focuses on the **consumption** side: translating structured metric and dimension definitions into efficient queries, executing them, and surfacing results through a typed API and UI.

You'll build a small but representative slice of that system.

---

## What's provided

This repository includes:

- `data/events.csv` — a seed dataset of raw B2B marketing campaign events with the following columns:

  | Column        | Type      | Description                              |
  | ------------- | --------- | ---------------------------------------- |
  | `event_id`    | string    | Unique event identifier                  |
  | `campaign_id` | string    | Campaign identifier                      |
  | `account_id`  | string    | Target account (company)                 |
  | `channel`     | string    | `email`, `linkedin`, `display`, `search` |
  | `event_type`  | string    | `impression`, `click`, `conversion`      |
  | `occurred_at` | timestamp | When the event happened                  |

- `src/semantic-layer.ts` — a starter semantic layer definition:

  ```ts
  export const metrics = {
    impressions: {
      label: "Impressions",
      sql: "COUNT(CASE WHEN event_type = 'impression' THEN 1 END)",
    },
    clicks: {
      label: "Clicks",
      sql: "COUNT(CASE WHEN event_type = 'click' THEN 1 END)",
    },
    conversions: {
      label: "Conversions",
      sql: "COUNT(CASE WHEN event_type = 'conversion' THEN 1 END)",
    },
    ctr: {
      label: "Click-Through Rate",
      sql: "CAST(COUNT(CASE WHEN event_type = 'click' THEN 1 END) AS REAL) / NULLIF(COUNT(CASE WHEN event_type = 'impression' THEN 1 END), 0)",
    },
    conversion_rate: {
      label: "Conversion Rate",
      sql: "CAST(COUNT(CASE WHEN event_type = 'conversion' THEN 1 END) AS REAL) / NULLIF(COUNT(CASE WHEN event_type = 'impression' THEN 1 END), 0)",
    },
  } as const;

  export const dimensions = {
    campaign: { label: "Campaign", sql: "campaign_id" },
    channel: { label: "Channel", sql: "channel" },
    account: { label: "Account", sql: "account_id" },
    date: { label: "Date", sql: "CAST(occurred_at AS DATE)" },
  } as const;
  ```

---

## The Challenge: Campaign Analytics API

### Layer 1 — Query builder

Build a `queryBuilder` function that accepts a `DataRequest`. From there it should generate and execute SQL against a database. You can use any SQL database you're comfortable with — you must seed `data/events.csv` into it as part of your setup.

Here is an example type for supporting a `DataRequest`. Feel free to modify this as you see fit, but the core idea is that the request references metrics and dimensions by their semantic layer keys, not raw SQL.

```ts
type DataRequest = {
  metrics: (keyof typeof metrics)[];
  dimensions?: (keyof typeof dimensions)[];
  filters?: {
    dimension: keyof typeof dimensions;
    operator: "eq" | "in" | "gte" | "lte";
    value: string | string[];
  }[];
  limit?: number;
};
```

The builder should:

- Construct valid SQL from the semantic definitions in `semantic-layer.ts`
- Validate the data request (e.g. unknown metric/dimension names should return a typed error, not a runtime crash)
- Return typed results

This is the core of the challenge. Take your time here.

### Layer 2 — API

Expose the query builder through an Express.js endpoint:

```
POST /query
Content-Type: application/json

{
  "metrics": ["ctr", "conversion_rate"],
  "dimensions": ["channel"],
  "filters": [{ "dimension": "campaign", "operator": "eq", "value": "campaign_abc" }]
}
```

Validate the request body — the schema should be derived from the semantic layer types so that adding a new metric or dimension automatically extends what the API accepts. Use any validation library you prefer (e.g. Zod, Valibot) or none at all.

### Layer 3 — UI widget

A single React component that renders a **campaign analytics table**. It should support:

- **Filtering** by `campaign` and/or `account` — e.g. scoping results to a specific campaign ID or target account
- **Grouping** by `campaign`, `account`, or `channel` — selectable by the user or via props

The component builds a `DataRequest` from the current filter/grouping state, calls `POST /query`, and displays the results as a table with CTR and conversion rate columns.

The component doesn't need to be styled beyond being readable. Any standard React setup is fine. It must be wired to the real API.

---

## CI/CD Pipeline

Include a GitHub Actions workflow (`.github/workflows/ci.yml`) that runs on pull requests and performs:

1. Type checking (`tsc --noEmit`)
2. Linting
3. Unit tests — include at least one test so this step passes; the suite doesn't need to be exhaustive
4. Docker image build (no image push required)

This is a first-class deliverable, not a bonus. It doesn't need to be perfect — it needs to exist and be defensible.

---

## Technical Constraints

- **TypeScript** throughout — no plain JavaScript
- **Express.js** for the API layer
- **Any SQL database** — load `data/events.csv` into the database of your choice; document how in your README
- **React** for the UI component — feel free to add any supporting packages (table libraries, data fetching, etc.)
- Tests are not required to be exhaustive, but at least one unit test is needed for the CI pipeline to pass — we'll discuss your testing approach in the interview

---

## How to Submit

1. Create a **private** GitHub repository for your solution.
2. Add the following GitHub accounts as collaborators (Settings → Collaborators → Add people): **`hsuabina`**, **`vrayco`**, **`mauriz3`**
3. Send the repository link to your hiring contact when you're done.

There is no required structure — organise the project however makes sense to you.

Your repository should include a `README.md` with:
- How to run the project locally
- A brief note on any significant decisions you made or trade-offs you accepted given the time constraint

---

## What We'll Discuss

To set expectations, the follow-up conversation will cover topics like:

- The query builder design — how it handles unknown inputs, how it could be extended (HAVING clauses, time comparisons, multiple filters)
- How your query builder would handle dimensions that live in a separate, related table rather than directly on events
- How you structured the API response — result shape, error handling, and how types flow from the query builder through to the HTTP response
- How this pattern maps to a production warehouse setup (e.g. BigQuery, Snowflake) — what changes, what stays the same
- Type safety in the semantic layer — could a new metric be added without touching the query builder?
- Your CI/CD pipeline design and how it would evolve toward a full deployment pipeline
- Any trade-offs you explicitly accepted

---

## Questions?

If anything in the requirements is ambiguous, make a reasonable assumption, note it in your README, and move on. We're more interested in how you handle ambiguity than whether you guessed our exact intent.

Good luck — we're looking forward to the conversation.
