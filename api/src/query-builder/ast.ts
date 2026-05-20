/**
 * Step 1: Build a QueryAst from a validated DataRequest.
 *
 * Validates semantic constraints (unknown keys, operator/kind compatibility,
 * value shape) that Zod alone cannot express. Returns the AST or throws
 * ValidationError — never lets bad input reach the compile step.
 */

// --- types and constants ---

import { ValidationError, dimensions, metrics } from '@octane11/shared';
import type { DataRequest, DimensionKey, DimensionKind, Filter, MetricKey, Operator } from '@octane11/shared';

export type SelectNode =
  | { kind: 'metric'; key: MetricKey; alias: MetricKey }
  | { kind: 'dimension'; key: DimensionKey; alias: DimensionKey };

export type WhereNode = {
  key: DimensionKey;
  op: Operator;
  value: string | string[];
};

export type QueryAst = {
  select: SelectNode[];
  from: 'events';
  where: WhereNode[];
  groupBy: DimensionKey[];
  orderBy: { alias: MetricKey | DimensionKey; dir: 'asc' | 'desc' }[];
  limit: number;
  offset: number;
};

const VALID_OPS: Record<DimensionKind, Operator[]> = {
  string: ['eq', 'in'],
  date: ['eq', 'gte', 'lte'],
};

// --- helpers ---

function validateFilter(f: Filter, index: number): void {
  const dim = dimensions[f.dimension];
  if (!dim) throw new ValidationError(`Unknown dimension: ${f.dimension}`, `filters[${index}].dimension`);

  const allowed = VALID_OPS[dim.kind];
  if (!allowed.includes(f.operator)) {
    throw new ValidationError(
      `Operator '${f.operator}' is not valid for ${dim.kind} dimension '${f.dimension}'. Allowed: ${allowed.join(', ')}`,
      `filters[${index}].operator`
    );
  }

  if (f.operator === 'in' && !Array.isArray(f.value)) {
    throw new ValidationError(
      `Filter on '${f.dimension}' with operator 'in' requires an array value`,
      `filters[${index}].value`
    );
  }
  if (f.operator !== 'in' && Array.isArray(f.value)) {
    throw new ValidationError(
      `Filter on '${f.dimension}' with operator '${f.operator}' requires a scalar value`,
      `filters[${index}].value`
    );
  }
}

// --- public API ---

export function buildAst(req: DataRequest): QueryAst {
  if (!req.metrics.length) throw new ValidationError('At least one metric is required', 'metrics');

  for (const [i, key] of req.metrics.entries()) {
    if (!(key in metrics)) throw new ValidationError(`Unknown metric: ${key}`, `metrics[${i}]`);
  }

  for (const [i, key] of (req.dimensions ?? []).entries()) {
    if (!(key in dimensions)) throw new ValidationError(`Unknown dimension: ${key}`, `dimensions[${i}]`);
  }

  for (const [i, ob] of (req.orderBy ?? []).entries()) {
    if (!(ob.key in metrics) && !(ob.key in dimensions)) {
      throw new ValidationError(`Unknown orderBy key: ${ob.key}`, `orderBy[${i}].key`);
    }
  }

  const limit = req.limit ?? 100;
  if (limit > 1000) throw new ValidationError('limit must not exceed 1000', 'limit');

  for (const [i, f] of (req.filters ?? []).entries()) validateFilter(f, i);

  const dimKeys = (req.dimensions ?? []) as DimensionKey[];

  const select: SelectNode[] = [
    ...dimKeys.map((key) => ({ kind: 'dimension' as const, key, alias: key })),
    ...(req.metrics as MetricKey[]).map((key) => ({ kind: 'metric' as const, key, alias: key })),
  ];

  const where: WhereNode[] = (req.filters ?? []).map((f) => ({
    key: f.dimension,
    op: f.operator,
    value: f.value,
  }));

  const orderBy = (req.orderBy ?? []).map((ob) => ({
    alias: ob.key as MetricKey | DimensionKey,
    dir: ob.direction,
  }));

  return {
    select,
    from: 'events',
    where,
    groupBy: dimKeys,
    orderBy,
    limit,
    offset: req.offset ?? 0,
  };
}
