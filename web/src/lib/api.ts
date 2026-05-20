import type { DataRequest, DataResponse, MasterdataResponse } from '@octane11/shared';

// Fail loud at module load if the API URL is missing — silent 404s are worse than a boot error.
const BASE = import.meta.env.VITE_API_URL;
if (!BASE) throw new Error('VITE_API_URL is not set');

export async function fetchMasterdata(): Promise<MasterdataResponse> {
  const res = await fetch(`${BASE}/masterdata`);
  if (!res.ok) throw new Error(`masterdata failed: ${res.status}`);
  return res.json() as Promise<MasterdataResponse>;
}

export async function fetchQuery(request: DataRequest): Promise<DataResponse> {
  const res = await fetch(`${BASE}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Query failed' }));
    throw new Error((err as { message?: string }).message ?? 'Query failed');
  }
  return res.json() as Promise<DataResponse>;
}
