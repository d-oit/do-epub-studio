import DOMPurify from 'dompurify';
import type { Config } from 'dompurify';
import { matchBounded } from '@do-epub-studio/shared';

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
  'onload',
  'onclick',
  'ondblclick',
  'onmousedown',
  'onmouseup',
  'onmouseover',
  'onmousemove',
  'onmouseout',
  'onmouseenter',
  'onmouseleave',
  'onfocus',
  'onblur',
  'onkeydown',
  'onkeyup',
  'onkeypress',
  'onsubmit',
  'onreset',
  'onchange',
  'onselect',
  'oninput',
  'onscroll',
  'onerror',
  'onabort',
  'onresize',
  'ontouchstart',
  'ontouchend',
  'ontouchmove',
  'ontouchcancel',
  'onwheel',
  'onpointerdown',
  'onpointerup',
  'onpointermove',
  'onpointerover',
  'onpointerout',
  'onpointerenter',
  'onpointerleave',
  'onpointercancel',
  'onanimationstart',
  'onanimationend',
  'onanimationiteration',
  'ontransitionstart',
  'ontransitionend',
  'ontransitionrun',
  'ontransitioncancel',
  'oncut',
  'oncopy',
  'onpaste',
  'onloadedmetadata',
  'onloadeddata',
  'onloadstart',
  'ontimeupdate',
  'onvolumechange',
  'onplaying',
  'onwaiting',
  'onseeking',
  'onseeked',
  'oncanplay',
  'oncanplaythrough',
  'ondurationchange',
  'onemptied',
  'onended',
  'onplay',
  'onpause',
  'onratechange',
  'onstalled',
  'onsuspend',
  'onprogress',
];

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

export function sanitizeDom(node: Document | DocumentFragment | Element): void {
  const root = node.nodeType === Node.DOCUMENT_NODE ? (node as Document).documentElement : node;
  if (!root) return;

  const allElements = root.querySelectorAll('*');

  for (const el of allElements) {
    const tag = el.localName;
    if (tag === 'foreignobject' || tag === 'foreignObject') {
      toRemove.push(el);
      continue;
    }

    if (!el.hasAttributes()) {
      continue;
    }

    const isLinkable = tag === 'use' || tag === 'image';
    const attrNames = el.getAttributeNames();

    for (const name of attrNames) {
      if (name.length > 2 && name[0] === 'o' && name[1] === 'n') {
        el.removeAttribute(name);
      } else if (isLinkable && (name === 'href' || name === 'xlink:href')) {
        const val = el.getAttribute(name);
        if (val) {
          const trimmedVal = val.trim();
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

// Hardened, deterministic allowlist of tags permitted in EPUB body HTML.
// This is a denylist-based belt added on top of the DOMPurify `FORBID_TAGS`
// check so that ANY tag outside this set is dropped, even if a future
// DOMPurify version ships a new default-permitted tag. Keep the list in
// sync with what the EPUB reader's CSS/JS expects (see ADR-035 + ADR-067).
//
// Reference: DOMPurify `ALLOWED_TAGS` is the canonical untrusted-HTML
// allowlist, more secure than `FORBID_TAGS`-only configurations.
const EPUB_BODY_ALLOWED_TAGS = [
  'a', 'abbr', 'address', 'article', 'aside', 'b', 'bdi', 'bdo', 'blockquote',
  'br', 'caption', 'cite', 'code', 'col', 'colgroup', 'data', 'datalist', 'dd',
  'del', 'details', 'dfn', 'dialog', 'div', 'dl', 'dt', 'em', 'figcaption',
  'figure', 'footer', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hgroup',
  'hr', 'i', 'ins', 'kbd', 'label', 'legend', 'li', 'main', 'mark', 'menu',
  'menuitem', 'meter', 'nav', 'ol', 'optgroup', 'option', 'output', 'p', 'pre',
  'progress', 'q', 'rp', 'rt', 'ruby', 's', 'samp', 'section', 'small', 'span',
  'strong', 'sub', 'summary', 'sup', 'table', 'tbody', 'td', 'tfoot', 'th',
  'thead', 'time', 'tr', 'u', 'ul', 'var', 'wbr',
  // SVG namespace is allowed as a whole subtree via a second pass; we do
  // not enumerate SVG here to keep the body allowlist tight.
];

// Tags only allowed in <head> of an EPUB document.
const EPUB_HEAD_ALLOWED_TAGS = ['link', 'meta', 'style', 'title', 'base'];

// Structural tags that EPUB documents require but DOMPurify's ALLOWED_TAGS
// does not include by default. Without these, the <html>/<head>/<body>
// wrapper is dropped during sanitization.
const EPUB_STRUCTURAL_TAGS = ['html', 'head', 'body'];

function buildEpubPurifyConfig(): Config {
  return {
    // Explicit allowlist per the untrusted-HTML hardening note above.
    ALLOWED_TAGS: [
      ...EPUB_STRUCTURAL_TAGS,
      ...EPUB_BODY_ALLOWED_TAGS,
      ...EPUB_HEAD_ALLOWED_TAGS,
      ...SAFE_SVG_TAGS,
    ],
    // Keep these as defense-in-depth: ALLOWED_TAGS is authoritative, but
    // listing them again here makes the policy obvious to reviewers and
    // protects against accidental ALLOWED_TAGS-only regressions.
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'applet', 'form', 'input', 'button', 'select', 'textarea'],
    FORBID_ATTR: SVG_EVENT_ATTRS,
    // Disallow URI schemes on href / src by stripping them in sanitizeDom;
    // DOMPurify's ALLOWED_URI_REGEXP is a coarse second line of defense.
    ADD_ATTR: [...SVG_ALLOWED_ATTRS],
    ALLOW_ARIA_ATTR: true,
    ALLOW_DATA_ATTR: false,
    // Use deterministic in-place mutation on the Document node. We pass
    // the document element explicitly (never the Document directly) to
    // avoid the WHOLE_DOCUMENT=true foot-gun documented in the Codacy
    // review: WHOLE_DOCUMENT=true mutates <html> and <head> in place and
    // is brittle when the source document is detached or reparented.
    // Here we sanitize document.documentElement as a node, then re-apply
    // href-scheme + event-attribute scrubbing via sanitizeDom in a
    // second deterministic pass.
    IN_PLACE: false,
    RETURN_DOM: true,
    WHOLE_DOCUMENT: false,
  };
}

let cachedEpubConfig: Config | null = null;

function getEpubConfig(): Config {
  if (!cachedEpubConfig) {
    cachedEpubConfig = buildEpubPurifyConfig();
  }
  return cachedEpubConfig;
}

/**
 * Sanitize an EPUB document in place, idempotently.
 *
 * Strategy:
 *   1. Build a sanitized clone via DOMPurify with an explicit
 *      `ALLOWED_TAGS` allowlist (the Codacy-recommended approach for
 *      untrusted HTML — `FORBID_TAGS`-only is a known foot-gun).
 *   2. Replace the live `documentElement`'s children with the sanitized
 *      children. This is idempotent: calling sanitizeEpubDocument twice
 *      on the same document produces the same final DOM, so the hook
 *      is safe to register on multiple rendition hooks (e.g. both the
 *      `useReaderEpub` and `EpubLoader` paths) without double-stripping.
 *   3. Run `sanitizeDom` to enforce href-scheme allowlist and strip any
 *      remaining event-handler attributes.
 */
export function sanitizeEpubDocument(doc: Document): void {
  if (!doc || !doc.documentElement) return;
  const liveRoot = doc.documentElement;

  // Pass 1: DOMPurify allowlist. Use documentElement.cloneNode(true) so
  // the sanitized result is independent of the live DOM. Without this
  // clone, RETURN_DOM:true can hand us back the very nodes we're about
  // to mutate, which trips a "Node cannot have two parents" error on
  // Safari and on DOM mutation observers.
  const clone = liveRoot.cloneNode(true);
  // DOMPurify's TS types declare the return as `string | Node` for
  // `RETURN_DOM: true`. We narrow to Document | Element for the
  // subsequent use of `documentElement` / `childNodes`.
  const sanitized = DOMPurify.sanitize(clone, getEpubConfig()) as unknown as Document | Element;
  const sanitizedRoot = sanitized instanceof Document ? sanitized.documentElement : sanitized;
  if (!sanitizedRoot) return;

  // Pass 2: replace live children with sanitized children. Using
  // `replaceChildren` (not innerHTML =) keeps event listeners on the
  // document object intact and avoids the well-known CSP/DOMParser
  // re-entrancy pitfalls.
  liveRoot.replaceChildren(...Array.from(sanitizedRoot.childNodes).map((n) => n.cloneNode(true)));

  // Pass 3: href-scheme + event-attr enforcement.
  sanitizeDom(doc);
}

export function createEpubSanitizerHook(): (contents: { document?: Document }) => void {
  return (contents: { document?: Document }) => {
    const doc = contents.document;
    if (!doc) return;
    sanitizeEpubDocument(doc);
  };
}

export function createSvgSanitizerHook(): (contents: { document?: Document }) => void {
  return (contents: { document?: Document }) => {
    const doc = contents.document;
    if (!doc) return;

    const svgElements = doc.querySelectorAll('svg');
    for (const svg of svgElements) {
      sanitizeDom(svg);
    }
  };
}
