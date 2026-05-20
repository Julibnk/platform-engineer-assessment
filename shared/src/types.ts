import type { DimensionKey, DimensionKind, MetricKey, MetricKind } from './semantic.js';

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
  /** default 100, max 1000 */
  limit?: number;
  /** default 0 */
  offset?: number;
};

export type DataRow = Record<string, string | number | null>;

export type ColumnMeta = {
  key: string;
  label: string;
  kind: MetricKind | DimensionKind;
};

export type DataResponse = {
  rows: DataRow[];
  columns: ColumnMeta[];
};

export type MasterdataResponse = {
  metrics: Record<MetricKey, { label: string; kind: MetricKind }>;
  dimensions: Record<DimensionKey, { label: string; kind: DimensionKind }>;
  campaigns: string[];
  accounts: string[];
  channels: string[];
};
