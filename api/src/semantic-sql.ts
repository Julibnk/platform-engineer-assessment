// SQL fragments for each metric and dimension key.
// These never leave the server — the frontend only sees labels and kinds.
// Identifiers here are static strings, never derived from user input.

import type { DimensionKey, MetricKey } from '@octane11/shared';

export const metricSql: Record<MetricKey, string> = {
  impressions: "COUNT(CASE WHEN event_type = 'impression' THEN 1 END)",
  clicks: "COUNT(CASE WHEN event_type = 'click' THEN 1 END)",
  conversions: "COUNT(CASE WHEN event_type = 'conversion' THEN 1 END)",
  ctr: "CAST(COUNT(CASE WHEN event_type = 'click' THEN 1 END) AS REAL) / NULLIF(COUNT(CASE WHEN event_type = 'impression' THEN 1 END), 0)",
  conversion_rate:
    "CAST(COUNT(CASE WHEN event_type = 'conversion' THEN 1 END) AS REAL) / NULLIF(COUNT(CASE WHEN event_type = 'impression' THEN 1 END), 0)",
};

export const dimensionSql: Record<DimensionKey, string> = {
  campaign: 'campaign_id',
  channel: 'channel',
  account: 'account_id',
  date: "CAST(occurred_at AS DATE)",
};
