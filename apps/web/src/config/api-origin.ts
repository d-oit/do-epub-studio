/**
 * Build-time API origin resolution (issue #1482).
 *
 * The frontend reaches the API through exactly one origin:
 *  - `VITE_API_BASE_URL` when set and valid, or
 *  - the same-origin `/api/*` route served by Cloudflare Pages Functions —
 *    the only canonical production API host.
 *
 * The same-origin fallback is only sound because Pages co-hosts the API and
 * the SPA (the `apps/web/functions/api/[[path]].ts` catch-all). On any other
 * host, `/api/*` is not guaranteed and an unset variable is a
 * misconfiguration that must fail the deployment gate (incident #1014:
 * Render served the SPA's HTML at `/api/*` with status 200).
 *
 * This module is intentionally free of `import.meta` so the exact same
 * validation runs in the browser bundle and in Vite's Node-side build config
 * (`vite.config.ts`), where an invalid production origin fails the build.
 */
export interface ApiOriginInput {
  readonly raw: string | undefined;
  readonly isProduction: boolean;
}

export type ApiOriginResolution =
  { readonly kind: 'configured'; readonly url: string } | { readonly kind: 'same-origin' };

export type ApiOriginValidationResult =
  | { readonly ok: true; readonly resolution: ApiOriginResolution }
  | { readonly ok: false; readonly reason: string };

/**
 * Hosts whose `/api/*` cannot be guaranteed: they serve the SPA with a
 * catch-all fallback (Render's incident #1014) or have no Pages Functions.
 * Rejected only in production builds; dev builds may point anywhere for
 * local experimentation.
 */
export const SPA_ONLY_HOST_SUFFIXES = [
  'onrender.com',
  'vercel.app',
  'netlify.app',
  'github.io',
] as const;

function findPlaceholderReason(raw: string, hostname: string): string | null {
  const lowered = raw.toLowerCase();
  const host = hostname.toLowerCase();
  if (host === 'example.com' || host.endsWith('.example.com')) {
    return `"${hostname}" is a placeholder domain (example.com)`;
  }
  if (host === 'workers.dev' || host.endsWith('.workers.dev')) {
    return `"${hostname}" is a Workers placeholder origin (workers.dev)`;
  }
  if (host === 'worker.dev' || host.endsWith('.worker.dev')) {
    return `"${hostname}" is a Workers placeholder origin (worker.dev)`;
  }
  if (raw.includes('<') || raw.includes('>')) {
    return `"${raw}" contains angle-bracket placeholder markers`;
  }
  if (
    lowered.includes('placeholder') ||
    lowered.includes('replaceme') ||
    lowered.includes('replace-me')
  ) {
    return `"${raw}" contains a placeholder marker`;
  }
  return null;
}

/**
 * Validate a `VITE_API_BASE_URL` value.
 *
 * - Missing/empty is valid and resolves to same-origin `/api/*` (Pages
 *   Functions assumption, documented in docs/runbooks/infrastructure-setup.md).
 * - Must be an absolute http(s) URL at the origin root: no path, query,
 *   fragment, or credentials.
 * - Production requires https (rejects leaked dev/localhost origins, i.e.
 *   cross-environment config).
 * - Placeholders (workers.dev, example.com, angle brackets, "placeholder"
 *   markers) are rejected in every environment.
 * - Known SPA-only frontend hosts (Render's `onrender.com`, Vercel,
 *   Netlify, GitHub Pages) are rejected in production: their `/api/*` is not
 *   served by Pages Functions.
 */
export function validateApiOrigin(input: ApiOriginInput): ApiOriginValidationResult {
  const raw = input.raw?.trim();
  if (!raw) {
    return { ok: true, resolution: { kind: 'same-origin' } };
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: `"${raw}" is not a valid absolute URL` };
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, reason: `protocol "${url.protocol}" is not http(s)` };
  }
  if (input.isProduction && url.protocol !== 'https:') {
    return {
      ok: false,
      reason: `production builds must use https (got "${url.protocol}") — is a dev/localhost origin leaking into production?`,
    };
  }
  if (url.username || url.password) {
    return { ok: false, reason: 'origin must not embed credentials' };
  }
  if (url.search) {
    return { ok: false, reason: 'origin must not include query parameters' };
  }
  if (url.hash) {
    return { ok: false, reason: 'origin must not include a fragment' };
  }
  if (url.pathname !== '/' && url.pathname !== '') {
    return { ok: false, reason: `origin must have no path (got "${url.pathname}")` };
  }

  const hostname = url.hostname.toLowerCase();
  const placeholderReason = findPlaceholderReason(raw, hostname);
  if (placeholderReason) {
    return { ok: false, reason: placeholderReason };
  }

  if (input.isProduction) {
    const spaHost = SPA_ONLY_HOST_SUFFIXES.find(
      (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`),
    );
    if (spaHost) {
      return {
        ok: false,
        reason: `"${hostname}" is a known SPA-only host (${spaHost}) whose /api/* is not served by Pages Functions (incident #1014)`,
      };
    }
  }

  return { ok: true, resolution: { kind: 'configured', url: `${url.protocol}//${url.host}` } };
}

/**
 * Resolve the API origin for a given environment. Invalid values fall back to
 * the canonical same-origin `/api/*` route (production builds fail first via
 * the vite.config.ts guard, so this path is only reachable in dev or when the
 * variable is simply absent).
 */
export function resolveApiBaseUrl(input: ApiOriginInput): ApiOriginResolution {
  const result = validateApiOrigin(input);
  return result.ok ? result.resolution : { kind: 'same-origin' };
}
