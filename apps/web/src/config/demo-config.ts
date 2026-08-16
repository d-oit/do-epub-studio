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
 * Resolve the help URL from public env config. Returns `null` when the URL
 * is missing, empty, or fails validation.
 *
 * Accepts an absolute `http(s)` URL (rendered as an external link when it
 * points off-origin) or a same-origin path starting with `/` (e.g.
 * `VITE_HELP_URL=/help`) so an in-app help page works on any origin —
 * localhost, previews, and production — without baking a hostname.
 */
export function resolveHelpUrl(): HelpLinkProps | null {
  const raw = import.meta.env.VITE_HELP_URL;
  if (!raw) return null;

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';

  // Same-origin path: point at it relative to whatever origin serves the app.
  if (raw.startsWith('/')) {
    return { href: raw, isExternal: false };
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }

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
