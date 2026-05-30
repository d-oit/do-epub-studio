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

const SVG_HREF_ATTRS = ['xlink:href', 'href'];

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
  const root = node.nodeType === Node.DOCUMENT_NODE
    ? (node as Document).documentElement
    : node;
  if (!root) return;

  const allElements = root.querySelectorAll('*');
  const toRemove: Element[] = [];

  for (const el of allElements) {
    const tag = el.tagName.toLowerCase();
    if (tag === 'foreignobject') {
      toRemove.push(el);
      continue;
    }

    for (const attr of SVG_EVENT_ATTRS) {
      el.removeAttribute(attr);
    }

    if (tag === 'use' || tag === 'image') {
      for (const hrefAttr of SVG_HREF_ATTRS) {
        const val = el.getAttribute(hrefAttr);
        if (val) {
          const trimmed = val.trim();
          const schemeMatch = matchBounded(/^([a-zA-Z][a-zA-Z0-9+.-]*):/, trimmed, 2048);
          if (schemeMatch && schemeMatch[1]) {
            const scheme = schemeMatch[1].toLowerCase();
            if (scheme !== 'http' && scheme !== 'https' && scheme !== 'mailto') {
              el.removeAttribute(hrefAttr);
            }
          } else {
            const lower = trimmed.toLowerCase();
            if (
              lower.startsWith('javascript:') ||
              lower.startsWith('data:') ||
              lower.startsWith('vbscript:')
            ) {
              el.removeAttribute(hrefAttr);
            }
          }
        }
      }
    }
  }

  for (const el of toRemove) {
    el.parentNode?.removeChild(el);
  }
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

export function sanitizeEpubDocument(doc: Document): void {
  const root = doc.documentElement || doc;
  DOMPurify.sanitize(root, {
    IN_PLACE: true,
    WHOLE_DOCUMENT: true,
    USE_PROFILES: { html: true, svg: true },
    FORBID_TAGS: [
      'script',
      'iframe',
      'object',
      'embed',
      'applet',
      'animate',
      'set',
      'animateMotion',
      'animateTransform',
    ],
    FORBID_ATTR: [...SVG_EVENT_ATTRS],
    ALLOW_ARIA_ATTR: true,
    ALLOW_DATA_ATTR: false,
  });
}
