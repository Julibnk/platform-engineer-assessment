import { z } from 'zod';
import { dimensions, metrics } from './semantic.js';
import type { DimensionKey, MetricKey } from './semantic.js';
import type { DataRequest } from './types.js';

// Cast to literal tuples so z.enum infers the correct union, not string
const dimensionKeys = Object.keys(dimensions) as [DimensionKey, ...DimensionKey[]];
const metricKeys = Object.keys(metrics) as [MetricKey, ...MetricKey[]];

const filterSchema = z.object({
  dimension: z.enum(dimensionKeys),
  operator: z.enum(['eq', 'in', 'gte', 'lte'] as const),
  value: z.union([z.string(), z.array(z.string())]),
});

const orderBySchema = z.object({
  key: z.union([z.enum(metricKeys), z.enum(dimensionKeys)]),
  direction: z.enum(['asc', 'desc'] as const),
});

// z.ZodType<T> — types declared first, Zod is the wire validator
export const dataRequestSchema: z.ZodType<DataRequest> = z.object({
  metrics: z.array(z.enum(metricKeys)).min(1),
  dimensions: z.array(z.enum(dimensionKeys)).optional(),
  filters: z.array(filterSchema).optional(),
  orderBy: z.array(orderBySchema).optional(),
  limit: z.number().int().min(1).max(1000).optional(),
  offset: z.number().int().min(0).optional(),
});
