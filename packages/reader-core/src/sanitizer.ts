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
export const SANITIZER_POLICY_VERSION = 2;

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
 * Sanitizes one element's attributes in place: strips `on*` event handlers and
 * removes non-whitelisted-scheme hrefs from linkable elements. `el.localName`
 * is already lowercase for HTML/SVG so callers avoid `.toLowerCase()` overhead.
 *
 * `feImage` is included alongside `use`/`image`: it references an external
 * raster/filter resource via `href`/`xlink:href`, so an un-checked `data:`/
 * `ftp:`/`javascript:` href would otherwise slip through the EPUB pipeline
 * (pass (a) permits `href` on allowed SVG tags, and only this pass enforces
 * the scheme allowlist for non-`use`/`image` linkable elements).
 */
function sanitizeElementAttributes(el: Element): void {
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
    if (!isLinkable || (name !== 'href' && name !== 'xlink:href')) continue;

    const val = attr.value;
    if (!val) continue;
    const scheme = getScheme(val.trim());
    if (scheme !== null && !ALLOWED_SCHEMES.has(scheme)) {
      el.removeAttribute(name);
    }
  }
}

export function sanitizeDom(
  node: Document | DocumentFragment | Element,
  deadline?: number,
  timeoutMs?: number,
  traceId?: string,
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
      sanitizeElementAttributes(el);
    }
    el = walker.nextNode() as Element | null;
  }
}

export function sanitizeEpubDocument(
  doc: Document,
  options?: { timeoutMs?: number; traceId?: string },
): void {
  const timeoutMs = options?.timeoutMs ?? SANITIZE_TIMEOUT_MS;
  const traceId = options?.traceId;
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
  sanitizeDom(doc, deadline, timeoutMs, traceId);
}
export interface SanitizeHook {
  hook: (contents: { document?: Document; href?: string }) => void;
}

export function createEpubSanitizerHook(
  options?: { timeoutMs?: number; traceId?: string; policyVersion?: number },
): SanitizeHook {
  const policyVersion = options?.policyVersion ?? SANITIZER_POLICY_VERSION;
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
        sanitizeDom(doc, deadline, timeoutMs, options?.traceId);
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
  options?: { timeoutMs?: number; traceId?: string },
): (contents: { document?: Document }) => void {
  return (contents: { document?: Document }) => {
    const doc = contents.document;
    if (!doc) return;

    const timeoutMs = options?.timeoutMs ?? SANITIZE_TIMEOUT_MS;
    const traceId = options?.traceId;
    const deadline = createDeadline(timeoutMs);

    const svgElements = doc.querySelectorAll('svg');
    for (const svg of svgElements) {
      sanitizeDom(svg, deadline, timeoutMs, traceId);
    }
  };
}
