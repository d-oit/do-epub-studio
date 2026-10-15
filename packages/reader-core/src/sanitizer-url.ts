const MAX_HOST_LENGTH = 253;
const ALLOWED_SCHEMES = new Set(['http', 'https', 'mailto']);

export interface ExternalUrlPolicy {
  mode: 'block-all' | 'allowlist';
  hosts?: string[];
}

export const DEFAULT_EXTERNAL_URL_POLICY: ExternalUrlPolicy = { mode: 'block-all' };

export function isAlphaCode(code: number): boolean {
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

export function isSchemeCharCode(code: number): boolean {
  return (
    isAlphaCode(code) ||
    (code >= 48 && code <= 57) ||
    code === 43 /* + */ ||
    code === 46 /* . */ ||
    code === 45 /* - */
  );
}

export function equalsIgnoreCase(value: string, lower: string): boolean {
  if (value.length !== lower.length) return false;
  for (let i = 0; i < value.length; i++) {
    if ((value.charCodeAt(i) | 32) !== lower.charCodeAt(i)) return false;
  }
  return true;
}

export function getScheme(val: string): string | null {
  let cleanVal = '';
  for (let i = 0; i < val.length; i++) {
    const code = val.charCodeAt(i);
    if (code > 32) {
      cleanVal += val.charAt(i);
    }
  }

  const colonIdx = cleanVal.indexOf(':');
  if (colonIdx <= 0 || colonIdx > 2048) return null;

  if (!isAlphaCode(cleanVal.charCodeAt(0))) return null;
  for (let i = 1; i < colonIdx; i++) {
    if (!isSchemeCharCode(cleanVal.charCodeAt(i))) return null;
  }

  return cleanVal.substring(0, colonIdx).toLowerCase();
}

export function isDnsHostCharCode(code: number): boolean {
  return (code >= 97 && code <= 122) || (code >= 48 && code <= 57) || code === 45 || code === 46;
}

export function findHostEnd(val: string, start: number): number {
  let end = val.length;
  for (let i = start; i < end; i++) {
    const code = val.charCodeAt(i);
    if (code === 47 || code === 63 || code === 35) {
      end = i;
      break;
    }
  }
  return end;
}

export function stripHostCredentials(
  val: string,
  start: number,
  initialEnd: number,
): [number, number] | null {
  let hostStart = start;
  let end = initialEnd;
  for (let i = start; i < end; i++) {
    if (val.charCodeAt(i) === 64) hostStart = i + 1;
  }
  if (hostStart >= end) return null;
  for (let i = hostStart; i < end; i++) {
    if (val.charCodeAt(i) === 58) {
      end = i;
      break;
    }
  }
  if (hostStart >= end) return null;
  return [hostStart, end];
}

export function parseHttpHost(val: string): string | null {
  const schemeIdx = val.indexOf('://');
  if (schemeIdx <= 0) return null;
  const hostStart = schemeIdx + 3;
  const hostEnd = findHostEnd(val, hostStart);
  if (hostEnd <= hostStart) return null;
  const span = stripHostCredentials(val, hostStart, hostEnd);
  if (span === null) return null;
  const [start, end] = span;
  if (end - start > MAX_HOST_LENGTH) return null;
  let host = val.substring(start, end).toLowerCase();
  while (host.length > 0 && host.charCodeAt(host.length - 1) === 46) {
    host = host.slice(0, -1);
  }
  if (host.length === 0) return null;
  for (let i = 0; i < host.length; i++) {
    if (!isDnsHostCharCode(host.charCodeAt(i))) return null;
  }
  return host;
}

export function hostMatchesAllowlistEntry(host: string, entry: string): boolean {
  const normalized = parseHttpHost(entry.includes('://') ? entry : `https://${entry}`);
  if (normalized === null) return false;
  return host === normalized || host.endsWith(`.${normalized}`);
}

export function isAllowedExternalHost(urlValue: string, policy: ExternalUrlPolicy): boolean {
  const hosts = policy.mode === 'allowlist' ? policy.hosts : undefined;
  if (!hosts || hosts.length === 0) return false;
  const host = parseHttpHost(urlValue);
  if (host === null) return false;
  for (const entry of hosts) {
    if (hostMatchesAllowlistEntry(host, entry)) return true;
  }
  return false;
}

export function shouldStripHref(val: string, policy: ExternalUrlPolicy): boolean {
  const scheme = getScheme(val);
  if (scheme === null) return false;
  if (scheme === 'http' || scheme === 'https') {
    return !isAllowedExternalHost(val, policy);
  }
  return !ALLOWED_SCHEMES.has(scheme);
}

export function shouldStripCssUrl(urlVal: string, policy: ExternalUrlPolicy): boolean {
  const scheme = getScheme(urlVal);
  if (scheme === null) return false;
  if (scheme === 'javascript' || scheme === 'vbscript') return true;
  if (scheme === 'data') {
    const lower = urlVal.toLowerCase();
    if (lower.startsWith('data:image/')) return false;
    return true;
  }
  if (scheme === 'http' || scheme === 'https') {
    return !isAllowedExternalHost(urlVal, policy);
  }
  return !ALLOWED_SCHEMES.has(scheme);
}
