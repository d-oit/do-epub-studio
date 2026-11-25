import type { ZodType } from 'zod';

/**
 * API contract registry types (issue #1489).
 *
 * The registry is the single hand-maintained source of truth describing the
 * public HTTP surface of the Worker. The snapshot generator
 * (`scripts/generate-api-contract.mjs`) renders it to
 * `apps/worker/api-contract.json`, and a Vitest snapshot test fails on any
 * drift (a new route, a changed status code, a schema change) so breaking API
 * changes require an explicit, reviewed snapshot update.
 */

export type ContractMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type ContractAuth = 'public' | 'reader' | 'author' | 'admin' | 'admin-step-up' | 'admin-mfa';

export type ContractResponseKind = 'json' | 'binary' | 'hybrid';

export interface ApiContractRequest {
  /** Query-string schema (mirrors `zValidator('query', schema)` on the route). */
  query?: ZodType;
  /** JSON body schema (mirrors `zValidator('json', schema)` on the route). */
  body?: ZodType;
}

export interface ApiContractEntry {
  /** Full public path in Hono syntax, e.g. `/api/books/:id`. */
  path: string;
  method: ContractMethod;
  auth: ContractAuth;
  /**
   * Status codes this endpoint is expected to produce for well-formed requests
   * (success + domain statuses). Global error codes (400/401/403/404/429/500)
   * are implied and not listed.
   */
  statusCodes: number[];
  /**
   * - `json`: the response must be the JSON envelope (enforced at runtime).
   * - `binary`: the response is a raw byte stream (files, signed downloads).
   * - `hybrid`: JSON for some inputs, binary for others (EPUB export).
   */
  responseKind?: ContractResponseKind;
  request?: ApiContractRequest;
  /** Zod schema for the success payload (`data`), when the shape is pinned. */
  response?: ZodType;
}

export const API_CONTRACT_VERSION = 1;
