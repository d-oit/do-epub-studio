import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { toJSONSchema } from 'zod';
import type { ZodType } from 'zod';
import { app } from '../app';
import { API_CONTRACT_ROUTES } from './registry';
import {
  API_CONTRACT_VERSION,
  type ApiContractEntry,
  type ContractAuth,
  type ContractMethod,
  type ContractResponseKind,
} from './types';

/**
 * Snapshot generator for the API contract (issue #1489).
 *
 * `buildApiContract()`:
 * 1. introspects the live Hono router (`app.routes`) for the actual public
 *    surface (method + path),
 * 2. asserts the hand-maintained registry (`API_CONTRACT_ROUTES`) is exactly
 *    in sync with it — a missing or stale entry fails hard,
 * 3. serializes every declared Zod schema to a stable JSON shape
 *    (`toJSONSchema`) and returns the contract rows.
 *
 * The snapshot test regenerates and deep-compares against
 * `apps/worker/api-contract.json`; the generator script reuses the same code
 * in write mode. `z` schemas are serialized, never executed, so the snapshot
 * is a pure data artifact.
 */
type JsonSchema = Record<string, unknown> | null;

export interface ApiContractRow {
  path: string;
  method: ContractMethod;
  auth: ContractAuth;
  statusCodes: number[];
  responseKind: ContractResponseKind;
  requestSchemaShape: { query: JsonSchema; body: JsonSchema };
  responseSchemaShape: JsonSchema;
}

export interface ApiContractSnapshot {
  version: number;
  generatedAt: string;
  routes: ApiContractRow[];
}

const SNAPSHOT_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '../../api-contract.json');

function serializeSchema(schema: ZodType | undefined): JsonSchema {
  if (!schema) return null;
  return toJSONSchema(schema as never);
}

/** Unique (method, path) surface of the live router (`use`/OPTIONS excluded). */
export function routerSurface(): Array<{ method: string; path: string }> {
  const seen = new Set<string>();
  const out: Array<{ method: string; path: string }> = [];
  for (const route of app.routes) {
    if (route.method === 'ALL' || route.method === 'OPTIONS') continue;
    const key = `${route.method} ${route.path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ method: route.method, path: route.path });
  }
  return out.sort((a, b) => a.method.localeCompare(b.method) || a.path.localeCompare(b.path));
}

function registrySurface(entries: readonly ApiContractEntry[]): string[] {
  return entries.map((e) => `${e.method} ${e.path}`).sort();
}

/**
 * Verify registry completeness against the live router. Throws with a diff
 * listing every missing/extra route so a breaking change is unmissable.
 */
export function assertRegistryMatchesRouter(entries: readonly ApiContractEntry[]): void {
  const routerKeys = routerSurface().map((r) => `${r.method} ${r.path}`);
  const registryKeys = registrySurface(entries);

  const missing = routerKeys.filter((key) => !registryKeys.includes(key));
  const extra = registryKeys.filter((key) => !routerKeys.includes(key));

  if (missing.length > 0 || extra.length > 0) {
    const lines: string[] = [];
    if (missing.length > 0) {
      lines.push('Routes present in the router but MISSING from the contract registry:');
      for (const key of missing) lines.push(`  - ${key}`);
    }
    if (extra.length > 0) {
      lines.push('Registry entries with NO matching router route:');
      for (const key of extra) lines.push(`  - ${key}`);
    }
    throw new Error(`API contract registry is out of sync with the router.\n${lines.join('\n')}`);
  }
}

function buildRows(entries: readonly ApiContractEntry[]): ApiContractRow[] {
  assertRegistryMatchesRouter(entries);
  return entries
    .map((entry) => ({
      path: entry.path,
      method: entry.method,
      auth: entry.auth,
      statusCodes: [...entry.statusCodes].sort((a, b) => a - b),
      responseKind: entry.responseKind ?? 'json',
      requestSchemaShape: {
        query: serializeSchema(entry.request?.query),
        body: serializeSchema(entry.request?.body),
      },
      responseSchemaShape: serializeSchema(entry.response),
    }))
    .sort((a, b) => a.method.localeCompare(b.method) || a.path.localeCompare(b.path));
}

export function buildApiContract(): ApiContractSnapshot {
  return {
    version: API_CONTRACT_VERSION,
    generatedAt: new Date().toISOString(),
    routes: buildRows(API_CONTRACT_ROUTES),
  };
}

export function readApiContractSnapshot(): ApiContractSnapshot {
  return JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8')) as ApiContractSnapshot;
}

/** Write the snapshot (generator script / snapshot update mode). */
export function writeApiContractSnapshot(snapshot: ApiContractSnapshot): string {
  writeFileSync(SNAPSHOT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  return SNAPSHOT_PATH;
}

export const API_CONTRACT_SNAPSHOT_PATH = SNAPSHOT_PATH;
