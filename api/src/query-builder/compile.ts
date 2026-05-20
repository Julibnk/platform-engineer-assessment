/**
 * Step 2: Compile a QueryAst into a parameterised SQL statement.
 *
 * Security guarantees:
 * - All identifiers (column SQL) come from the server-side semantic maps,
 *   never from user input. buildAst guarantees keys are valid literals.
 * - All user-supplied values are bound as '?' parameters — never interpolated.
 */

// --- types ---

import type { QueryAst, SelectNode } from './ast.js';
import { metricSql, dimensionSql } from '../semantic-sql.js';

export type CompiledQuery = { sql: string; params: unknown[] };

// --- helpers ---

function lookupSql(key: string, map: Record<string, string>): string {
  const sql = map[key];
  // Defense-in-depth: this should never happen if buildAst is correct.
  if (!sql) throw new Error(`[compile] Missing SQL fragment for key: ${key}`);
  return sql;
}

function sqlFragment(node: SelectNode): string {
  const expr =
    node.kind === 'metric'
      ? lookupSql(node.key, metricSql)
      : lookupSql(node.key, dimensionSql);

  return `${expr} AS ${node.alias}`;
}

// --- public API ---

export function compile(ast: QueryAst): CompiledQuery {
  const params: unknown[] = [];

  const selectClause = ast.select.map(sqlFragment).join(', ');

  // WHERE — values always go into params, never into the SQL string
  const whereParts: string[] = ast.where.map((node) => {
    const col = lookupSql(node.key, dimensionSql);

    if (node.op === 'eq') {
      params.push(node.value);
      return `${col} = ?`;
    }
    if (node.op === 'in') {
      const values = node.value as string[];
      values.forEach((v) => params.push(v));
      return `${col} IN (${values.map(() => '?').join(', ')})`;
    }
    if (node.op === 'gte') {
      params.push(node.value);
      return `${col} >= ?`;
    }
    // lte
    params.push(node.value);
    return `${col} <= ?`;
  });

  // GROUP BY and ORDER BY both use aliases (semantic keys) — consistent, SQLite-supported.
  const groupByClause =
    ast.groupBy.length > 0 ? `GROUP BY ${ast.groupBy.join(', ')}` : '';

  const orderByClause =
    ast.orderBy.length > 0
      ? `ORDER BY ${ast.orderBy.map((ob) => `${ob.alias} ${ob.dir.toUpperCase()}`).join(', ')}`
      : '';

  const parts = [
    `SELECT ${selectClause}`,
    `FROM ${ast.from}`,
    whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '',
    groupByClause,
    orderByClause,
    `LIMIT ?`,
    `OFFSET ?`,
  ].filter(Boolean);

  params.push(ast.limit, ast.offset);

  return { sql: parts.join(' '), params };
}
