import type { ApiContractEntry, ContractMethod } from './types';
import { publicRoutes } from './routes-public';
import { readerRoutes } from './routes-reader';
import { authorRoutes } from './routes-author';
import { adminRoutes } from './routes-admin';
import { adminAuthRoutes } from './routes-admin-auth';

/**
 * The full hand-maintained API contract registry (issue #1489). The snapshot
 * generator renders this to `apps/worker/api-contract.json`; a Vitest test
 * fails on any drift between this registry and the live Hono router, so a new
 * or renamed route forces an explicit, reviewed contract update.
 */
export const API_CONTRACT_ROUTES: readonly ApiContractEntry[] = [
  ...publicRoutes,
  ...readerRoutes,
  ...authorRoutes,
  ...adminRoutes,
  ...adminAuthRoutes,
];

/** Cache of compiled matchers (method + path pattern -> entry). */
let matchers: Array<{ method: ContractMethod; regex: RegExp; entry: ApiContractEntry }> | null =
  null;

function compileMatchers() {
  if (matchers) return matchers;
  matchers = API_CONTRACT_ROUTES.map((entry) => {
    // Convert Hono path syntax to a regex: `:param` and `:param{.+}` -> named capture.
    const source = entry.path
      .replace(/:[^/]+(\{\.\+\})?/g, (match) => (match.includes('{') ? '(.+)' : '([^/]+)'))
      .replace(/\//g, '\\/');
    return {
      method: entry.method,
      regex: new RegExp(`^${source}$`),
      entry,
    };
  });
  return matchers;
}

/** Look up the contract entry for a request method + path (if any). */
export function matchContractRoute(method: string, path: string): ApiContractEntry | undefined {
  for (const matcher of compileMatchers()) {
    if (matcher.method === method && matcher.regex.test(path)) {
      return matcher.entry;
    }
  }
  return undefined;
}
