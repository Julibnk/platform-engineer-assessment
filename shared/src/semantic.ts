// Semantic layer metadata — shared between api and web.
// SQL fragments live in api/src/semantic-sql.ts (server-only).

export type DimensionKind = 'string' | 'date';
export type MetricKind = 'count' | 'ratio';

export const dimensions = {
  campaign: { label: 'Campaign', kind: 'string' as DimensionKind },
  channel: { label: 'Channel', kind: 'string' as DimensionKind },
  account: { label: 'Account', kind: 'string' as DimensionKind },
  date: { label: 'Date', kind: 'date' as DimensionKind },
} as const satisfies Record<string, { label: string; kind: DimensionKind }>;

export const metrics = {
  impressions: { label: 'Impressions', kind: 'count' as MetricKind },
  clicks: { label: 'Clicks', kind: 'count' as MetricKind },
  conversions: { label: 'Conversions', kind: 'count' as MetricKind },
  ctr: { label: 'CTR', kind: 'ratio' as MetricKind },
  conversion_rate: { label: 'Conv. Rate', kind: 'ratio' as MetricKind },
} as const satisfies Record<string, { label: string; kind: MetricKind }>;

export type DimensionKey = keyof typeof dimensions;
export type MetricKey = keyof typeof metrics;
