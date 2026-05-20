import { describe, it, expect } from 'vitest';
import { ValidationError } from '@octane11/shared';
import { buildAst } from '../src/query-builder/ast.js';
import { compile } from '../src/query-builder/compile.js';

// --- buildAst: validation ---

describe('buildAst — validation', () => {
  it('throws ValidationError with field path for unknown metric', () => {
    try {
      buildAst({ metrics: ['unknown_metric' as never] });
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect((e as ValidationError).field).toBe('metrics[0]');
    }
  });

  it('throws ValidationError with field path for unknown dimension', () => {
    try {
      buildAst({ metrics: ['impressions'], dimensions: ['bad_dim' as never] });
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect((e as ValidationError).field).toBe('dimensions[0]');
    }
  });

  it('throws when gte is used on a string dimension', () => {
    try {
      buildAst({
        metrics: ['impressions'],
        filters: [{ dimension: 'campaign', operator: 'gte', value: 'abc' }],
      });
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect((e as ValidationError).field).toBe('filters[0].operator');
    }
  });

  it('throws when in operator receives a scalar value', () => {
    try {
      buildAst({
        metrics: ['impressions'],
        filters: [{ dimension: 'campaign', operator: 'in', value: 'campaign_abc' }],
      });
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect((e as ValidationError).field).toBe('filters[0].value');
    }
  });

  it('throws when limit exceeds 1000', () => {
    try {
      buildAst({ metrics: ['impressions'], limit: 1001 });
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect((e as ValidationError).field).toBe('limit');
    }
  });

  it('throws when no metrics are provided', () => {
    expect(() => buildAst({ metrics: [] })).toThrow(ValidationError);
  });
});

// --- compile: SQL output ---

describe('compile — SQL correctness', () => {
  it('produces correct clauses for a full request', () => {
    const ast = buildAst({
      metrics: ['ctr', 'impressions'],
      dimensions: ['channel'],
      filters: [{ dimension: 'campaign', operator: 'eq', value: 'campaign_abc' }],
      orderBy: [{ key: 'ctr', direction: 'desc' }],
      limit: 10,
      offset: 5,
    });

    const { sql, params } = compile(ast);

    expect(sql).toContain('GROUP BY channel');
    expect(sql).toContain('ORDER BY ctr DESC');
    expect(sql).toContain('WHERE campaign_id = ?');
    expect(sql).toContain('LIMIT ?');
    expect(sql).toContain('OFFSET ?');
    expect(params).toEqual(['campaign_abc', 10, 5]);
  });

  it('expands IN into the correct number of placeholders', () => {
    const ast = buildAst({
      metrics: ['clicks'],
      filters: [{ dimension: 'channel', operator: 'in', value: ['email', 'linkedin', 'display'] }],
    });

    const { sql, params } = compile(ast);

    expect(sql).toContain('channel IN (?, ?, ?)');
    expect(params).toEqual(['email', 'linkedin', 'display', 100, 0]);
  });

  it('maps gte to >= and lte to <= with correct param placement', () => {
    const ast = buildAst({
      metrics: ['impressions'],
      filters: [
        { dimension: 'date', operator: 'gte', value: '2026-01-01' },
        { dimension: 'date', operator: 'lte', value: '2026-03-31' },
      ],
    });

    const { sql, params } = compile(ast);

    expect(sql).toContain('>= ?');
    expect(sql).toContain('<= ?');
    // params: gte value, lte value, limit, offset — order must match ? positions
    expect(params).toEqual(['2026-01-01', '2026-03-31', 100, 0]);
  });

  it('joins multiple WHERE conditions with AND', () => {
    const ast = buildAst({
      metrics: ['conversions'],
      filters: [
        { dimension: 'campaign', operator: 'eq', value: 'campaign_abc' },
        { dimension: 'channel', operator: 'eq', value: 'email' },
      ],
    });

    const { sql, params } = compile(ast);

    expect(sql).toContain('campaign_id = ? AND channel = ?');
    expect(params).toEqual(['campaign_abc', 'email', 100, 0]);
  });

  it('omits GROUP BY when no dimensions are requested', () => {
    const ast = buildAst({ metrics: ['impressions'] });
    const { sql } = compile(ast);
    expect(sql).not.toContain('GROUP BY');
  });

  it('omits WHERE when no filters are provided', () => {
    const ast = buildAst({ metrics: ['impressions'] });
    const { sql } = compile(ast);
    expect(sql).not.toContain('WHERE');
  });
});
