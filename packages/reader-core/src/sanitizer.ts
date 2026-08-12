import DOMPurify from 'dompurify';
import type { Config } from 'dompurify';
import { checkDeadline, createDeadline } from '@do-epub-studio/shared';

const SANITIZE_TIMEOUT_MS = 5_000;
const TREEWALKER_CHECK_INTERVAL = 100;
const SANITIZE_CACHE_MAX = 10;

/**
 * Cache-key prefix for the per-hook sanitizer LRU (GOAP-224 C6).
 *
 * `createEpubSanitizerHook()` builds a fresh in-memory `Map` per hook and, per
 * book load, a new hook is constructed — so the cache never outlives a book
 * session and there is no cross-build persistence to invalidate. The version
 * still matters: it is embedded in every cache key (`${version}:${href}`), so
 * bumping it when allowlists/behavior change guarantees that a long-lived hook
 * created with a newer policy never serves output sanitized under an older
 * policy, and separate-policy hooks never share entries (each captures its own
 * copy at construction; no caller passes it explicitly).
 */
export const SANITIZER_POLICY_VERSION = 3;

const SAFE_SVG_TAGS = [
  'svg',
  'g',
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'text',
  'tspan',
  'textPath',
  'defs',
  'use',
  'clipPath',
  'mask',
  'filter',
  'feBlend',
  'feColorMatrix',
  'feComponentTransfer',
  'feComposite',
  'feConvolveMatrix',
  'feDiffuseLighting',
  'feDisplacementMap',
  'feDistantLight',
  'feDropShadow',
  'feFlood',
  'feFuncA',
  'feFuncB',
  'feFuncG',
  'feFuncR',
  'feGaussianBlur',
  'feImage',
  'feMerge',
  'feMergeNode',
  'feMorphology',
  'feOffset',
  'fePointLight',
  'feSpecularLighting',
  'feSpotLight',
  'feTile',
  'feTurbulence',
  'linearGradient',
  'radialGradient',
  'stop',
  'image',
  'symbol',
  'marker',
  'pattern',
  'desc',
  'title',
  'metadata',
];

const SVG_EVENT_ATTRS = [
  'onload', 'onclick', 'ondblclick', 'onmousedown', 'onmouseup',
  'onmouseover', 'onmousemove', 'onmouseout', 'onmouseenter', 'onmouseleave',
  'onfocus', 'onblur', 'onkeydown', 'onkeyup', 'onkeypress',
  'onsubmit', 'onreset', 'onchange', 'onselect', 'oninput',
  'onscroll', 'onerror', 'onabort', 'onresize',
  'ontouchstart', 'ontouchend', 'ontouchmove', 'ontouchcancel',
  'onwheel', 'onpointerdown', 'onpointerup', 'onpointermove', 'onpointerover',
  'onpointerout', 'onpointerenter', 'onpointerleave', 'onpointercancel',
  'onanimationstart', 'onanimationend', 'onanimationiteration',
  'ontransitionstart', 'ontransitionend', 'ontransitionrun', 'ontransitioncancel',
  'oncut', 'oncopy', 'onpaste',
  'onloadedmetadata', 'onloadeddata', 'onloadstart', 'ontimeupdate',
  'onvolumechange', 'onplaying', 'onwaiting', 'onseeking', 'onseeked',
  'oncanplay', 'oncanplaythrough', 'ondurationchange', 'onemptied',
  'onended', 'onplay', 'onpause', 'onratechange', 'onstalled', 'onsuspend', 'onprogress',
];

const STRUCTURAL_TAGS = ['html', 'head', 'body'];

const EPUB_HEAD_TAGS = ['title', 'meta', 'link', 'style'];

const EPUB_BODY_TAGS = [
  'div',
  'p',
  'span',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'dl',
  'dt',
  'dd',
  'a',
  'img',
  'br',
  'hr',
  'em',
  'strong',
  'b',
  'i',
  'u',
  's',
  'sub',
  'sup',
  'code',
  'pre',
  'blockquote',
  'q',
  'cite',
  'dfn',
  'abbr',
  'data',
  'time',
  'var',
  'samp',
  'kbd',
  'mark',
  'ruby',
  'rt',
  'rp',
  'bdi',
  'bdo',
  'table',
  'caption',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
  'col',
  'colgroup',
  'main',
  'section',
  'article',
  'aside',
  'header',
  'footer',
  'nav',
  'figure',
  'figcaption',
  'details',
  'summary',
  'picture',
  'source',
  'svg',
];

const EPUB_ALLOWED_TAGS = [...STRUCTURAL_TAGS, ...EPUB_HEAD_TAGS, ...EPUB_BODY_TAGS, ...SAFE_SVG_TAGS];

const SVG_ALLOWED_ATTRS = [
  'id',
  'class',
  'style',
  'xmlns',
  'xmlns:xlink',
  'viewBox',
  'preserveAspectRatio',
  'x',
  'y',
  'width',
  'height',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'd',
  'dx',
  'dy',
  'points',
  'fill',
  'fill-opacity',
  'fill-rule',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-opacity',
  'stroke-dasharray',
  'stroke-dashoffset',
  'opacity',
  'transform',
  'rotate',
  'scale',
  'translate',
  'skewX',
  'skewY',
  'clip-path',
  'clip-rule',
  'mask',
  'filter',
  'flood-color',
  'flood-opacity',
  'stop-color',
  'stop-opacity',
  'offset',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'text-anchor',
  'text-decoration',
  'letter-spacing',
  'word-spacing',
  'alignment-baseline',
  'baseline-shift',
  'dominant-baseline',
  'display',
  'visibility',
  'overflow',
  'marker-start',
  'marker-mid',
  'marker-end',
  'markerWidth',
  'markerHeight',
  'refX',
  'refY',
  'orient',
  'patternUnits',
  'patternContentUnits',
  'patternTransform',
  'gradientUnits',
  'gradientTransform',
  'spreadMethod',
  'type',
  'values',
  'keyTimes',
  'keySplines',
  'calcMode',
  'begin',
  'dur',
  'end',
  'repeatCount',
  'repeatDur',
  'attributeName',
  'from',
  'to',
  'by',
  'additive',
  'accumulate',
  'result',
  'in',
  'in2',
  'stdDeviation',
  'edgeMode',
  'color-interpolation-filters',
  'color-interpolation',
  'color-rendering',
  'shape-rendering',
  'text-rendering',
  'image-rendering',
  'direction',
  'writing-mode',
  'glyph-orientation-horizontal',
  'glyph-orientation-vertical',
  'unicode-bidi',
  'lang',
  'tabindex',
  'role',
  'aria-label',
  'aria-hidden',
  'aria-describedby',
  'aria-labelledby',
  'aria-roledescription',
  'aria-live',
  'aria-atomic',
  'aria-relevant',
  'aria-busy',
  'aria-current',
];

function buildPurifyConfig(): Config {
  return {
    // Explicit allowlist — only known-safe SVG tags survive (no HTML tags).
    ALLOWED_TAGS: SAFE_SVG_TAGS,
    // ALLOWED_ATTR replaces DOMPurify's HTML default attribute list entirely.
    // Using ADD_ATTR would layer SVG attrs on top of the HTML defaults, leaving
    // data-*, aria-*, and event-like attributes from the HTML set in play.
    ALLOWED_ATTR: [...SVG_ALLOWED_ATTRS],
    // Belt-and-suspenders: block href/xlink:href on filter primitives (feImage
    // SSRF) and all event handlers even if ALLOWED_ATTR misses one.
    FORBID_ATTR: [...SVG_EVENT_ATTRS, 'href', 'xlink:href'],
    ALLOW_ARIA_ATTR: true,
    ALLOW_DATA_ATTR: false,
    WHOLE_DOCUMENT: false,
    RETURN_DOM_FRAGMENT: false,
    RETURN_DOM: false,
  };
}

let cachedConfig: Config | null = null;

function getConfig(): Config {
  if (!cachedConfig) {
    cachedConfig = buildPurifyConfig();
  }
  return cachedConfig;
}

export function sanitizeSvg(svgContent: string): string {
  return DOMPurify.sanitize(svgContent, getConfig());
}

/**
 * NOTE — intentional divergence from the external-URL policy (owl-watch
 * tracker "Inconsistent href sanitization policy between document and SVG
 * pass"): `sanitizeSvg` is for UNTRUSTED standalone SVG snippets and
 * unconditionally strips every `href`/`xlink:href` (FORBID_ATTR), regardless
 * of `ExternalUrlPolicy`. It has no production callers today. The EPUB content
 * pipeline (`sanitizeDom` → `sanitizeEpubDocument`/`createEpubSanitizerHook`)
 * is where per-book host allowlists apply, on a sanitizer that has already
 * vetted the document. If `sanitizeSvg` ever needs to honor a host allowlist,
 * switch it to the DOM pass + policy (like `createSvgSanitizerHook`) instead
 * of weakening FORBID_ATTR.
 */

/**
 * Whether `code` is an ASCII letter (A-Z, a-z) — the required first character
 * of a URI scheme per RFC 3986 §3.1.
 */
function isAlphaCode(code: number): boolean {
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

/**
 * Whether `code` is a valid (non-first) scheme character: letters, digits,
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
function getScheme(val: string): string | null {
  const colonIdx = val.indexOf(':');
  // A valid scheme must have at least one character before the first colon.
  // Cap the scan at 2048 to preserve the old matchBounded(w, 2048) rejection
  // window (ADR-034): a value whose first ':' sits beyond that bound had its
  // regex skipped and the attribute was kept. No browser-executable scheme is
  // anywhere near this long, so treating a longer prefix as "not a scheme"
  // (keep) cannot introduce a javascript:/data:/vbscript: vector — and keeps
  // per-attribute work constant-bounded. Schemes of 33..2048 chars that the old
  // 32-char assumption would have kept are still matched and removed.
  if (colonIdx <= 0 || colonIdx > 2048) return null;

  // The first character must be a letter (A-Z or a-z); the rest must be
  // scheme characters (letters/digits/"+"/"."/"-").
  if (!isAlphaCode(val.charCodeAt(0))) return null;
  for (let i = 1; i < colonIdx; i++) {
    if (!isSchemeCharCode(val.charCodeAt(i))) return null;
  }

  return val.substring(0, colonIdx).toLowerCase();
}

/** Schemes that are kept on linkable (`use`/`image`) href attributes. */
const ALLOWED_SCHEMES = new Set(['http', 'https', 'mailto']);

/**
 * Policy for absolute `http(s)` URLs in EPUB content — the counterpart to the
 * scheme allowlist, closing the remaining MEDIUM external-URL gap (GOAP-224):
 * a scheme-only grant previously let any `http(s)` host through, so a
 * malicious book could reference an arbitrary tracking/CDN host.
 *
 * - `{ mode: 'block-all' }` (DEFAULT): every absolute `http(s)` href on a
 *   linkable element is stripped. EPUB content cannot cause any network
 *   egress. This matches the security checklist ("External resource loading
 *   blocked in EPUB") and the privacy-first stance of the reader.
 * - `{ mode: 'allowlist', hosts: [...] }`: an `http(s)` href is kept only when
 *   its host equals an entry or is a strict subdomain of one (e.g.
 *   `example.com` also allows `img.example.com`). Entries are host-only — no
 *   scheme/port/path.
 *
 * `mailto:`, scheme-less relative, and fragment URLs are never subject to this
 * policy (they cannot cause network egress).
 */
export interface ExternalUrlPolicy {
  mode: 'block-all' | 'allowlist';
  hosts?: string[];
}

export const DEFAULT_EXTERNAL_URL_POLICY: ExternalUrlPolicy = { mode: 'block-all' };

/** Upper bound for a hostname (max DNS label length): rejects absurd input. */
const MAX_HOST_LENGTH = 253;

/**
 * Extracts the lowercased, scheme/port/userinfo-stripped hostname from an
 * absolute `http://`/`https://` URL, or `null` if the value is not a
 * well-formed one. Char-scan based (no regex / URL-parser allocation), bounded
 * to DNS length — mirrors the constant-work approach of `getScheme`. An
 * unparseable value returns `null` so callers can default-deny.
 */
function isDnsHostCharCode(code: number): boolean {
  return (
    (code >= 97 && code <= 122) /* a-z */ ||
    (code >= 48 && code <= 57) /* 0-9 */ ||
    code === 45 /* - */ ||
    code === 46 /* . */
  );
}

/** Index just past the hostname segment: first '/', '?', '#' or end-of-string. */
function findHostEnd(val: string, start: number): number {
  let end = val.length;
  for (let i = start; i < end; i++) {
    const code = val.charCodeAt(i);
    if (code === 47 /* / */ || code === 63 /* ? */ || code === 35 /* # */) {
      end = i;
      break;
    }
  }
  return end;
}

/**
 * Returns `[hostStart, hostEnd]` for the actual hostname within `[start, ~)` of
 * `val`, or `null` if the resulting host is empty. Drops userinfo
 * ("user:pass@host") and any port (":8080").
 */
function stripHostCredentials(
  val: string,
  start: number,
  initialEnd: number,
): [number, number] | null {
  let hostStart = start;
  let end = initialEnd;
  for (let i = start; i < end; i++) {
    if (val.charCodeAt(i) === 64 /* @ */) hostStart = i + 1;
  }
  if (hostStart >= end) return null;
  for (let i = hostStart; i < end; i++) {
    if (val.charCodeAt(i) === 58 /* : */) {
      end = i;
      break;
    }
  }
  if (hostStart >= end) return null;
  return [hostStart, end];
}

/**
 * Extracts the lowercased, scheme/port/userinfo-stripped hostname from an
 * absolute `http://`/`https://` URL, or `null` if the value is not a
 * well-formed one. Char-scan based (no regex / URL-parser allocation), bounded
 * to DNS length — mirrors the constant-work approach of `getScheme`. An
 * unparseable value returns `null` so callers can default-deny.
 */
function parseHttpHost(val: string): string | null {
  const schemeIdx = val.indexOf('://');
  if (schemeIdx <= 0) return null;
  const hostStart = schemeIdx + 3;
  const hostEnd = findHostEnd(val, hostStart);
  if (hostEnd <= hostStart) return null;
  const span = stripHostCredentials(val, hostStart, hostEnd);
  if (span === null) return null;
  const [start, end] = span;
  if (end - start > MAX_HOST_LENGTH) return null;
  // Lowercase first so the char whitelist can be a-z/0-9/-/. regardless of
  // the source casing.
  let host = val.substring(start, end).toLowerCase();
  // Newer RFCs allow trailing dots; strip them so `example.com.` ===
  // `example.com` (also applies when a port follows, `example.com.:8443`).
  while (host.length > 0 && host.charCodeAt(host.length - 1) === 46 /* . */) {
    host = host.slice(0, -1);
  }
  if (host.length === 0) return null;
  for (let i = 0; i < host.length; i++) {
    if (!isDnsHostCharCode(host.charCodeAt(i))) return null;
  }
  return host;
}

/**
 * Whether an absolute `http(s)` URL's host passes the given policy. Under
 * `block-all` (default) nothing passes; under `allowlist`, the host must equal
 * an entry or be a strict subdomain of one.
 */
export function isAllowedExternalHost(urlValue: string, policy: ExternalUrlPolicy): boolean {
  if (policy.mode === 'block-all') return false;
  const hosts = policy.hosts;
  if (!hosts || hosts.length === 0) return false;
  const host = parseHttpHost(urlValue);
  if (host === null) return false;
  for (const entry of hosts) {
    const normalized = parseHttpHost(entry.includes('://') ? entry : `https://${entry}`);
    if (normalized === null) continue;
    if (host === normalized || host.endsWith(`.${normalized}`)) return true;
  }
  return false;
}

/**
 * Whether a linkable element's `href`/`xlink:href` value must be stripped:
 * scheme-aware gate that keeps relative/fragment and `mailto:` URLs, applies
 * the host allowlist (default-deny) to absolute `http(s)` URLs, and drops every
 * other scheme (data:/javascript:/ftp:/…).
 */
function shouldStripHref(val: string, policy: ExternalUrlPolicy): boolean {
  const scheme = getScheme(val.trim());
  if (scheme === null) return false; // relative / fragment — keep
  if (scheme === 'http' || scheme === 'https') {
    // Host allowlist (Layer 1 of the external-URL guard): default-deny.
    return !isAllowedExternalHost(val, policy);
  }
  return !ALLOWED_SCHEMES.has(scheme);
}

/**
 * Sanitizes one element's attributes in place: strips `on*` event handlers and
 * applies the scheme + host policy to hrefs on linkable elements. `el.localName`
 * is already lowercase for HTML/SVG so callers avoid `.toLowerCase()` overhead.
 *
 * `feImage` is included alongside `use`/`image`: it references an external
 * raster/filter resource via `href`/`xlink:href`, so an un-checked `data:`/
 * `ftp:`/`javascript:` href would otherwise slip through the EPUB pipeline
 * (pass (a) permits `href` on allowed SVG tags, and only this pass enforces
 * the scheme allowlist for non-`use`/`image` linkable elements).
 */
function sanitizeElementAttributes(el: Element, policy: ExternalUrlPolicy): void {
  const localName = el.localName;
  // SVG local names preserve case (feImage) in both HTML and XHTML/XML parse
  // modes, so compare case-insensitively rather than relying on one casing.
  const isLinkable =
    localName === 'use' ||
    localName === 'image' ||
    localName.toLowerCase() === 'feimage';
  const attrs = el.attributes;

  for (let i = attrs.length - 1; i >= 0; i--) {
    const attr = attrs.item(i);
    if (!attr) continue;
    const name = attr.name;
    if (name.startsWith('on')) {
      el.removeAttribute(name);
      continue;
    }
    if (isLinkable && (name === 'href' || name === 'xlink:href')) {
      const val = attr.value;
      if (val && shouldStripHref(val, policy)) {
        el.removeAttribute(name);
      }
    }
  }
}

export function sanitizeDom(
  node: Document | DocumentFragment | Element,
  deadline?: number,
  timeoutMs?: number,
  traceId?: string,
  policy: ExternalUrlPolicy = DEFAULT_EXTERNAL_URL_POLICY,
): void {
  const root = node.nodeType === Node.DOCUMENT_NODE ? (node as Document).documentElement : node;
  if (!root) return;

  const ownerDoc = root.ownerDocument || (root.nodeType === Node.DOCUMENT_NODE ? root : null);
  if (!ownerDoc) return;

  // Use TreeWalker instead of querySelectorAll('*') to avoid creating a large static NodeList
  // and reduce memory pressure during traversal.
  const walker = ownerDoc.createTreeWalker(root, 1 /* NodeFilter.SHOW_ELEMENT */);

  // To match querySelectorAll('*') behavior, we skip the root element itself.
  let el = walker.nextNode() as Element | null;
  let nodeCount = 0;

  while (el) {
    if (deadline !== undefined && ++nodeCount % TREEWALKER_CHECK_INTERVAL === 0) {
      checkDeadline(deadline, 'epub-sanitize', timeoutMs ?? SANITIZE_TIMEOUT_MS, traceId);
    }

    if (el.hasAttributes()) {
      sanitizeElementAttributes(el, policy);
    }
    el = walker.nextNode() as Element | null;
  }
}

export function sanitizeEpubDocument(
  doc: Document,
  options?: { timeoutMs?: number; traceId?: string; externalUrlPolicy?: ExternalUrlPolicy },
): void {
  const timeoutMs = options?.timeoutMs ?? SANITIZE_TIMEOUT_MS;
  const traceId = options?.traceId;
  const policy = options?.externalUrlPolicy ?? DEFAULT_EXTERNAL_URL_POLICY;
  const deadline = createDeadline(timeoutMs);

  const root = doc.documentElement;
  if (!root) return;

  // Pass (a): DOMPurify allowlist on a clone
  const sanitized = DOMPurify.sanitize(root, {
    ALLOWED_TAGS: EPUB_ALLOWED_TAGS,
    ADD_ATTR: [...SVG_ALLOWED_ATTRS, 'content', 'name', 'property', 'rel', 'href', 'src', 'type'],
    FORBID_ATTR: SVG_EVENT_ATTRS,
    RETURN_DOM: true,
    WHOLE_DOCUMENT: true,
  }) as Element;

  checkDeadline(deadline, 'epub-sanitize', timeoutMs, traceId);

  // Pass (b): Sync sanitized state back to live document
  // We replace children of <html> with sanitized <head> and <body>
  if (sanitized.tagName.toLowerCase() === 'html') {
    root.replaceChildren(...Array.from(sanitized.childNodes));
    // Also sync attributes of <html> (like lang, dir)
    for (const attr of Array.from(root.attributes)) {
      root.removeAttribute(attr.name);
    }
    for (const attr of Array.from(sanitized.attributes)) {
      root.setAttribute(attr.name, attr.value);
    }
  } else {
    // If DOMPurify returned something else, just replace everything
    root.replaceChildren(sanitized);
  }

  checkDeadline(deadline, 'epub-sanitize', timeoutMs, traceId);

  // Pass (c): sanitizeDom() for href-scheme + event-attr enforcement
  sanitizeDom(doc, deadline, timeoutMs, traceId, policy);
}
export interface SanitizeHook {
  hook: (contents: { document?: Document; href?: string }) => void;
}

export function createEpubSanitizerHook(
  options?: {
    timeoutMs?: number;
    traceId?: string;
    policyVersion?: number;
    externalUrlPolicy?: ExternalUrlPolicy;
  },
): SanitizeHook {
  const policyVersion = options?.policyVersion ?? SANITIZER_POLICY_VERSION;
  const policy = options?.externalUrlPolicy ?? DEFAULT_EXTERNAL_URL_POLICY;
  const cache = new Map<string, string>();

  function keyFor(href: string): string {
    return `${policyVersion}:${href}`;
  }

  // GOAP-224 B5 (accepted-with-rationale): the cache stores serialized HTML
  // strings, so a cache HIT re-parses cached output with a browser-native
  // DOMParser + sanitizeDom instead of holding live Element nodes in the Map.
  // This is intentional — detached DOM nodes would keep large subtrees alive
  // per chapter (memory bloat + stale-reference risk), while the re-parse is
  // ~0.3-4ms for typical chapters (sub-ms to a few ms in the browser) and far
  // cheaper than re-running the multi-pass DOMPurify pipeline on a MISS.
  function copyHtmlAttributesWhenChanged(target: HTMLElement, source: HTMLElement): void {
    // Mirror sanitizeEpubDocument pass (b): sync <html> attributes (lang, dir)
    // so the cache-HIT and cache-MISS paths leave the live document with
    // identical attributes (GOAP-224 C14).
    for (const attr of Array.from(target.attributes)) {
      if (source.getAttribute(attr.name) === null) target.removeAttribute(attr.name);
    }
    for (const attr of Array.from(source.attributes)) {
      target.setAttribute(attr.name, attr.value);
    }
  }

  // Map iteration order === insertion order; on access we delete+re-set to
  // move the entry to the MRU position, giving true LRU eviction.
  function touch(href: string): string | undefined {
    const key = keyFor(href);
    const value = cache.get(key);
    if (value !== undefined) {
      cache.delete(key);
      cache.set(key, value);
    }
    return value;
  }

  function store(href: string, value: string): void {
    const key = keyFor(href);
    cache.set(key, value);
    if (cache.size > SANITIZE_CACHE_MAX) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
  }

  function hook(contents: { document?: Document; href?: string }): void {
    const doc = contents.document;
    if (!doc) return;
    const href = contents.href;
    if (href) {
      const cached = touch(href);
      if (cached !== undefined) {
        const root = doc.documentElement;
        const parser = new DOMParser();
        const cachedDoc = parser.parseFromString(cached, 'text/html');
        const cachedRoot = cachedDoc.documentElement;
        root.replaceChildren(...Array.from(cachedRoot.childNodes));
        copyHtmlAttributesWhenChanged(root, cachedRoot);
        const timeoutMs = options?.timeoutMs ?? SANITIZE_TIMEOUT_MS;
        const deadline = createDeadline(timeoutMs);
        sanitizeDom(doc, deadline, timeoutMs, options?.traceId, policy);
        return;
      }
    }

    sanitizeEpubDocument(doc, options);
    if (href) {
      store(href, doc.documentElement.outerHTML);
    }
  }

  return {
    hook,
  };
}

export function createSvgSanitizerHook(
  options?: {
    timeoutMs?: number;
    traceId?: string;
    externalUrlPolicy?: ExternalUrlPolicy;
  },
): (contents: { document?: Document }) => void {
  return (contents: { document?: Document }) => {
    const doc = contents.document;
    if (!doc) return;

    const timeoutMs = options?.timeoutMs ?? SANITIZE_TIMEOUT_MS;
    const traceId = options?.traceId;
    const policy = options?.externalUrlPolicy ?? DEFAULT_EXTERNAL_URL_POLICY;
    const deadline = createDeadline(timeoutMs);

    const svgElements = doc.querySelectorAll('svg');
    for (const svg of svgElements) {
      sanitizeDom(svg, deadline, timeoutMs, traceId, policy);
    }
  };
}

/**
 * Parity helper for the fetch-level egress guard (Layer 2): returns the
 * browser-security directives that keep book-local resources working while
 * default-denying external subresource egress.
 *
 * - `img-src 'self' blob: data:` keeps manifest resources (rewritten by epubjs
 *   to `blob:` URLs) and allowed `data:` images; in block-all mode NO external
 *   origin appears, so the browser cannot load any `http(s)` image.
 * - `style-src 'self' 'unsafe-inline' blob:` keeps book stylesheets (blob) and
 *   inline `<style>`/`style` attributes the sanitizer preserves.
 * - `font-src`/`media-src`/`connect-src` default-deny external egress.
 * - `object-src 'none'` / `frame-src 'none'` / `base-uri 'none'` / `form-action 'none'`
 *   harden against plugin/embedding/base-tag/form abuse.
 *
 * In allowlist mode, each allowlisted host (and its subdomains) is added as an
 * `https://<host>` source to `img-src`/`style-src`/`font-src`/`media-src`/
 * `connect-src`, so explicitly-allowed publishers/CDNs can load resources while
 * everything else stays blocked.
 */
export function buildExternalUrlCsp(policy: ExternalUrlPolicy): string {
  const origins: string[] = [];
  if (policy.mode === 'allowlist') {
    for (const entry of policy.hosts ?? []) {
      const host = parseHttpHost(entry.includes('://') ? entry : `https://${entry}`);
      if (host !== null) origins.push(`https://${host}`);
    }
  }
  const src = ['\'self\'', 'blob:', 'data:', ...origins].join(' ');
  const styleSrc = ['\'self\'', '\'unsafe-inline\'', 'blob:', 'data:', ...origins].join(' ');
  return [
    `img-src ${src}`,
    `style-src ${styleSrc}`,
    `font-src ${src}`,
    `media-src ${src}`,
    `connect-src ${'\'self\'' + (origins.length ? ` ${origins.join(' ')}` : '')}`,
    'object-src \'none\'',
    'frame-src \'none\'',
    'base-uri \'none\'',
    'form-action \'none\'',
  ].join('; ');
}

export interface ExternalUrlGuardHook {
  hook: (contents: { document?: Document } | Document) => void;
}

/**
 * Fetch-level egress guard (Layer 2 of the external-URL hardening): a rendition
 * content hook that injects a strict CSP `<meta>` into every rendered chapter
 * so the browser refuses external subresource fetches even if a URL evades the
 * sanitizer (e.g. a future bypass or a dynamically-injected element). The
 * sanitizer is Layer 1 and strips the same URLs at content-ingestion time; this
 * hook is the network-plane backstop.
 *
 * `contents` may be a `Contents` object (`.document`) or a raw `Document` —
 * mirroring the payload epubjs delivers to content hooks.
 */
export function createExternalUrlGuardHook(
  policy: ExternalUrlPolicy = DEFAULT_EXTERNAL_URL_POLICY,
): ExternalUrlGuardHook {
  const csp = buildExternalUrlCsp(policy);

  function hook(contents: { document?: Document } | Document): void {
    let doc: Document | null | undefined;
    if (contents && typeof contents === 'object' && 'document' in contents) {
      doc = contents.document;
    } else {
      doc = contents as Document | undefined;
    }
    if (!doc || !doc.head) return;
    const existing = doc.head.querySelector('meta[http-equiv="Content-Security-Policy"]');
    if (existing) {
      existing.setAttribute('content', csp);
      return;
    }
    const meta = doc.createElement('meta');
    meta.setAttribute('http-equiv', 'Content-Security-Policy');
    meta.setAttribute('content', csp);
    doc.head.appendChild(meta);
  }

  return { hook };
}
