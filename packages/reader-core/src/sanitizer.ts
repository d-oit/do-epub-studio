import DOMPurify from 'dompurify';
import type { Config } from 'dompurify';
import { matchBounded, checkDeadline, createDeadline } from '@do-epub-studio/shared';

const SANITIZE_TIMEOUT_MS = 5_000;
const TREEWALKER_CHECK_INTERVAL = 100;
const SANITIZE_CACHE_MAX = 10;

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
  'foreignObject',
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
    ADD_TAGS: [...SAFE_SVG_TAGS],
    ADD_ATTR: [...SVG_ALLOWED_ATTRS],
    FORBID_TAGS: ['foreignObject', 'script', 'style', 'iframe', 'object', 'embed', 'applet', 'meta', 'link'],
    FORBID_ATTR: SVG_EVENT_ATTRS,
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
      // Use localName which is already lowercase for HTML/SVG elements to avoid .toLowerCase() overhead.
      const tag = el.localName;
      const isLinkable = tag === 'use' || tag === 'image';
      const attrs = el.attributes;

      for (let i = attrs.length - 1; i >= 0; i--) {
        const attr = attrs.item(i);
        if (!attr) continue;
        const name = attr.name;
        if (name.startsWith('on')) {
          el.removeAttribute(name);
        } else if (isLinkable && (name === 'href' || name === 'xlink:href')) {
          const val = attr.value;
          if (val) {
            const trimmedVal = val.trim();
            if (trimmedVal.indexOf(':') !== -1) {
              const lowerVal = trimmedVal.toLowerCase();

              // Explicitly block dangerous schemes and non-whitelisted ones
              if (
                lowerVal.startsWith('javascript:') ||
                lowerVal.startsWith('data:') ||
                lowerVal.startsWith('vbscript:')
              ) {
                el.removeAttribute(name);
                continue;
              }

              // Guard regex against untrusted input per ADR-034
              const schemeMatch = matchBounded(/^([a-zA-Z][a-zA-Z0-9+.-]*):/, trimmedVal, 2048);
              if (schemeMatch && schemeMatch[1]) {
                const scheme = schemeMatch[1].toLowerCase();
                // Whitelist safe schemes
                if (scheme !== 'http' && scheme !== 'https' && scheme !== 'mailto') {
                  el.removeAttribute(name);
                }
              }
            }
          }
        }
      }
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
  options?: { timeoutMs?: number; traceId?: string },
): SanitizeHook {
  const cache = new Map<string, string>();
  function hook(contents: { document?: Document; href?: string }): void {
    const doc = contents.document;
    if (!doc) return;
    const href = contents.href;
    if (href) {
      const cached = cache.get(href);
      if (cached !== undefined) {
        const root = doc.documentElement;
        const parser = new DOMParser();
        const cachedDoc = parser.parseFromString(cached, 'text/html');
        root.replaceChildren(...Array.from(cachedDoc.documentElement.childNodes));
        const timeoutMs = options?.timeoutMs ?? SANITIZE_TIMEOUT_MS;
        const deadline = createDeadline(timeoutMs);
        sanitizeDom(doc, deadline, timeoutMs, options?.traceId);
        return;
      }
    }

    sanitizeEpubDocument(doc, options);
    if (href) {
      cache.set(href, doc.documentElement.outerHTML);
      if (cache.size > SANITIZE_CACHE_MAX) {
        const firstKey = cache.keys().next().value;
        if (firstKey !== undefined) cache.delete(firstKey);
      }
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
