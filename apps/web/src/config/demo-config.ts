/**
 * ADR-244: Public help URL contract for auth screens.
 *
 * Reads `VITE_HELP_URL`, validates it with the `URL` constructor, and returns
 * `null` when missing or invalid so callers can conditionally render the link.
 * External targets (non-origin) must use `rel="noopener noreferrer"`.
 */

export interface HelpLinkProps {
  href: string;
  isExternal: boolean;
}

/**
 * Resolve the help URL. The in-app `/help` route ships in every deployment,
 * so the default is that same-origin page. An explicit absolute `http(s)`
 * `VITE_HELP_URL` (external link when off-origin) or a leading-slash path
 * overrides it; an invalid explicit value still falls back to `/help`.
 */
export function resolveHelpUrl(): HelpLinkProps {
  const raw = import.meta.env.VITE_HELP_URL;
  const fallback: HelpLinkProps = { href: '/help', isExternal: false };
  if (!raw) return fallback;
  if (raw.startsWith('/')) {
    return { href: raw, isExternal: false };
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return fallback;
  }

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
  return { href: parsed.href, isExternal: parsed.origin !== currentOrigin };
}

/**
 * Whether the demo login buttons should be visible. Reads the public
 * `VITE_DEMO_LOGIN_ENABLED` flag — this is UI-only; the Worker gate
 * remains authoritative regardless of this value.
 */
export function isDemoLoginEnabled(): boolean {
  return import.meta.env.VITE_DEMO_LOGIN_ENABLED === '1';
}
