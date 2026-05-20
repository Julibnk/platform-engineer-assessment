import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table';
import { metrics as allMetrics } from '@octane11/shared';
import type { DataRequest, DataRow, DimensionKey, Filter, MetricKey } from '@octane11/shared';
import type { DimensionKind, MetricKind } from '@octane11/shared';
import { fetchMasterdata, fetchQuery } from '../lib/api.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table.js';

// Dimensions valid as group-by pivots — a subset of all dimensions.
const GROUP_BY_VALUES = ['campaign', 'account', 'channel'] as const satisfies readonly DimensionKey[];

function formatCell(value: unknown, kind: MetricKind | DimensionKind): string {
  if (value == null) return '—';
  if (kind === 'ratio') return `${(Number(value) * 100).toFixed(2)}%`;
  if (kind === 'count') return Number(value).toLocaleString();
  return String(value);
}

export function CampaignAnalyticsTable() {
  const [state, setState] = useQueryStates({
    groupBy: parseAsStringLiteral(GROUP_BY_VALUES).withDefault('campaign'),
    campaign: parseAsString.withDefault(''),
    account: parseAsString.withDefault(''),
  });

  const { data: masterdata } = useQuery({
    queryKey: ['masterdata'],
    queryFn: fetchMasterdata,
  });

  // Rebuild the API request whenever URL state changes.
  const request = useMemo<DataRequest>(() => {
    const filters: Filter[] = [];
    if (state.campaign) filters.push({ dimension: 'campaign', operator: 'eq', value: state.campaign });
    if (state.account) filters.push({ dimension: 'account', operator: 'eq', value: state.account });
    return {
      metrics: Object.keys(allMetrics) as MetricKey[],
      dimensions: [state.groupBy as DimensionKey],
      filters: filters.length ? filters : undefined,
      limit: 100,
    };
  }, [state]);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['query', request],
    queryFn: () => fetchQuery(request),
    // Keep previous data visible while the new request is in-flight.
    placeholderData: (prev) => prev,
  });

  const columns = useMemo<ColumnDef<DataRow>[]>(
    () =>
      (data?.columns ?? []).map((col) => ({
        accessorKey: col.key,
        header: col.label,
        cell: ({ getValue }) => formatCell(getValue(), col.kind),
      })),
    [data?.columns],
  );

  const table = useReactTable({
    data: data?.rows ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="space-y-4 p-6">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Group by</span>
          <Select
            value={state.groupBy}
            onValueChange={(v) => setState({ groupBy: v as (typeof GROUP_BY_VALUES)[number] })}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GROUP_BY_VALUES.map((v) => (
                <SelectItem key={v} value={v}>
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Campaign</span>
          <Select
            value={state.campaign || '__all__'}
            onValueChange={(v) => setState({ campaign: v === '__all__' ? '' : v })}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All campaigns</SelectItem>
              {masterdata?.campaigns.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Account</span>
          <Select
            value={state.account || '__all__'}
            onValueChange={(v) => setState({ account: v === '__all__' ? '' : v })}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All accounts</SelectItem>
              {masterdata?.accounts.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </div>

      {isError && (
        <p className="text-sm text-destructive">Error: {(error as Error).message}</p>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id}>
                    {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length || 1}
                  className="text-center text-muted-foreground"
                >
                  Loading…
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length || 1}
                  className="text-center text-muted-foreground"
                >
                  No results
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
