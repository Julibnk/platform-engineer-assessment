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
