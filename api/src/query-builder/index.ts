import type { Database } from 'better-sqlite3';
import { dimensions, metrics } from '@octane11/shared';
import type { DataRequest, DataResponse, ColumnMeta } from '@octane11/shared';
import { buildAst } from './ast.js';
import { compile } from './compile.js';

/**
 * Top-level entry point: validates → AST → SQL → executes → returns typed response.
 * Throws ValidationError for bad requests; other errors propagate to the error middleware.
 */
export function executeQuery(req: DataRequest, db: Database): DataResponse {
  const ast = buildAst(req);
  const { sql, params } = compile(ast);

  const rows = db.prepare(sql).all(...params) as Record<string, string | number | null>[];

  const columns: ColumnMeta[] = ast.select.map((node) => {
    const meta =
      node.kind === 'metric'
        ? metrics[node.key as keyof typeof metrics]
        : dimensions[node.key as keyof typeof dimensions];

    return { key: node.alias, label: meta.label, kind: meta.kind };
  });

  return { rows, columns };
}

export { buildAst } from './ast.js';
export { compile } from './compile.js';
