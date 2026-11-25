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

/** A compiled route matcher: literal prefix segments + param segment types. */
interface RouteMatcher {
  method: ContractMethod;
  /** True when the segment matches any value (`:param` or `:param{.+}`). */
  paramSegments: boolean[];
  /** Literal segment values (only for non-param positions). */
  literalSegments: (string | undefined)[];
  /** True when the pattern ends in a multi-segment wildcard (`:param{.+}`). */
  multiSegmentWildcard: boolean;
  entry: ApiContractEntry;
}

let matchers: RouteMatcher[] | null = null;

function compileMatchers(): RouteMatcher[] {
  if (matchers) return matchers;
  matchers = API_CONTRACT_ROUTES.map((entry) => {
    const segments = entry.path.split('/').filter(Boolean);
    const paramSegments = segments.map((segment) => segment.startsWith(':'));
    const literalSegments = segments.map((segment, index) =>
      paramSegments[index] ? undefined : segment,
    );
    const lastPatternSegment = segments[segments.length - 1] ?? '';
    const multiSegmentWildcard =
      paramSegments[paramSegments.length - 1] === true && lastPatternSegment.endsWith('{.+}');
    return {
      method: entry.method,
      paramSegments,
      literalSegments,
      multiSegmentWildcard,
      entry,
    };
  });
  return matchers;
}

/** Compare a request path (without query string) against a compiled matcher. */
function matchesPath(requestPath: string, matcher: RouteMatcher): boolean {
  const segments = requestPath.replace(/\/+$/, '').split('/').filter(Boolean);
  if (matcher.multiSegmentWildcard) {
    // A trailing multi-segment wildcard absorbs every remaining segment, so
    // the request path only needs to cover the pattern's preceding segments.
    if (segments.length < matcher.paramSegments.length) return false;
  } else if (segments.length !== matcher.paramSegments.length) {
    return false;
  }
  const limit = matcher.multiSegmentWildcard ? matcher.paramSegments.length : segments.length;
  for (let i = 0; i < limit; i++) {
    if (matcher.paramSegments[i]) continue;
    if (matcher.literalSegments[i] !== segments[i]) return false;
  }
  return true;
}

/** Look up the contract entry for a request method + path (if any). */
export function matchContractRoute(method: string, path: string): ApiContractEntry | undefined {
  const barePath = path.split('?')[0] ?? path;
  for (const matcher of compileMatchers()) {
    if (matcher.method === method && matchesPath(barePath, matcher)) {
      return matcher.entry;
    }
  }
  return undefined;
}
