/**
 * Keep epub.js-generated blob URLs through DOMPurify; sanitizeDom then permits
 * them only on local EPUB image sources and rejects them everywhere else.
 */
export const EPUB_ALLOWED_URI_REGEXP =
  /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|matrix|blob):|[^a-z]|[a-z+.-]+(?:[^-a-z+.:]|$))/i;

/**
 * Whether `code` is an ASCII letter (A-Z, a-z), the required first character
 * of a URI scheme per RFC 3986 §3.1.
 */
function isAlphaCode(code: number): boolean {
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

/**
 * Whether `code` is a valid non-first scheme character: letters, digits,
 * "+", ".", "-" (RFC 3986 §3.1).
 */
function isSchemeCharCode(code: number): boolean {
  return (
    isAlphaCode(code) ||
    (code >= 48 && code <= 57) ||
    code === 43 /* + */ ||
    code === 46 /* . */ ||
    code === 45 /* - */
  );
}

/**
 * Safely extracts the scheme part from a URI string (e.g. "https" from "https://example.com").
 * Returns the lowercase scheme, or null if no valid scheme is present.
 * This avoids the considerable overhead of regular expressions and matchBounded, improving sanitization performance.
 */
export function getScheme(val: string): string | null {
  // Fast skip leading whitespace without calling .trim() which allocates a substring
  let start = 0;
  const len = val.length;
  while (start < len && val.charCodeAt(start) <= 32) {
    start++;
  }

  const colonIdx = val.indexOf(':', start);
  // A valid scheme must have at least one character before the first colon.
  // Cap the scan at 2048 to preserve the old matchBounded(w, 2048) rejection
  // window (ADR-034): a value whose first ':' sits beyond that bound had its
  // regex skipped and the attribute was kept. No browser-executable scheme is
  // anywhere near this long, so treating a longer prefix as "not a scheme"
  // (keep) cannot introduce a javascript:/data:/vbscript: vector — and keeps
  // per-attribute work constant-bounded. Schemes of 33..2048 chars that the old
  // 32-char assumption would have kept are still matched and removed.
  if (colonIdx <= start || colonIdx - start > 2048) return null;

  // The first character must be a letter (A-Z or a-z); the rest must be
  // scheme characters (letters/digits/"+"/"."/"-").
  if (!isAlphaCode(val.charCodeAt(start))) return null;
  for (let i = start + 1; i < colonIdx; i++) {
    if (!isSchemeCharCode(val.charCodeAt(i))) return null;
  }

  return val.substring(start, colonIdx).toLowerCase();
}
