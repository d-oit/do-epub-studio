import DOMPurify from 'dompurify';
import type { Config } from 'dompurify';
import { checkDeadline, createDeadline } from '@do-epub-studio/shared';
import {
  SAFE_SVG_TAGS,
  SVG_EVENT_ATTRS,
  EPUB_ALLOWED_TAGS,
  SVG_ALLOWED_ATTRS,
  EPUB_ADD_ATTR,
} from './sanitizer-constants';
import {
  equalsIgnoreCase,
  isAllowedExternalHost,
  parseHttpHost,
  shouldStripCssUrl,
  shouldStripHref,
  type ExternalUrlPolicy,
  DEFAULT_EXTERNAL_URL_POLICY,
} from './sanitizer-url';

const SANITIZE_TIMEOUT_MS = 5_000;
const TREEWALKER_CHECK_INTERVAL = 100;
const SANITIZE_CACHE_MAX = 10;

export const SANITIZER_POLICY_VERSION = 4;

export type { ExternalUrlPolicy };
export { DEFAULT_EXTERNAL_URL_POLICY, isAllowedExternalHost };

function buildPurifyConfig(): Config {
  return {
    ALLOWED_TAGS: SAFE_SVG_TAGS,
    ALLOWED_ATTR: [...SVG_ALLOWED_ATTRS],
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
 * Strips legacy IE CSS expression() constructs by scanning open/close parenthesis depth.
 * Uses linear character iteration instead of a regular expression to guarantee zero ReDoS backtracking.
 */
function stripCssExpressions(cssText: string): string {
  let result = cssText;
  while (result.toLowerCase().includes('expression(')) {
    const idx = result.toLowerCase().indexOf('expression(');
    const open = result.indexOf('(', idx);
    if (open === -1) break;
    let depth = 1;
    let close = open + 1;
    while (close < result.length && depth > 0) {
      const char = result.charAt(close);
      if (char === '(') {
        depth++;
      } else if (char === ')') {
        depth--;
      }
      close++;
    }
    result = result.slice(0, idx) + 'none' + result.slice(close);
  }
  return result;
}

/**
 * Sanitizes CSS text in <style> tags or inline style attributes.
 * Strips expression(), -moz-binding, javascript/data-html schemes, and non-whitelisted url() hosts.
 */
export function sanitizeCssText(
  cssText: string,
  policy: ExternalUrlPolicy = DEFAULT_EXTERNAL_URL_POLICY,
): string {
  if (!cssText) return cssText;

  let sanitized = stripCssExpressions(cssText);
  sanitized = sanitized.replace(/-moz-binding\s*:[^;}]*/gi, '');

  sanitized = sanitized.replace(
    /@import\s+(?:url\(['"]?|['"])([^'"]+)(?:['"]?\)|['"])([^;]*);?/gi,
    (_match: string, urlValue: string, rest: string): string => {
      const trimmedUrl = urlValue.trim();
      if (shouldStripCssUrl(trimmedUrl, policy)) {
        return '/* removed @import */';
      }
      return `@import url("${trimmedUrl}") ${rest || ''};`;
    },
  );

  sanitized = sanitized.replace(
    /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/gi,
    (match: string, g1?: string, g2?: string, g3?: string): string => {
      const urlValue = (g1 ?? g2 ?? g3 ?? '').trim();
      if (shouldStripCssUrl(urlValue, policy)) {
        return 'url("")';
      }
      return match;
    },
  );

  return sanitized;
}

function sanitizeElementAttributes(el: Element, policy: ExternalUrlPolicy): void {
  const attrs = el.attributes;
  let isLinkable: boolean | undefined;

  for (let i = attrs.length - 1; i >= 0; i--) {
    const attr = attrs.item(i);
    if (!attr) continue;
    const name = attr.name;

    if (
      name.length >= 2 &&
      (name.charCodeAt(0) | 32) === 111 &&
      (name.charCodeAt(1) | 32) === 110
    ) {
      el.removeAttribute(name);
      continue;
    }

    if (name === 'style' && attr.value) {
      const cleanCss = sanitizeCssText(attr.value, policy);
      if (cleanCss !== attr.value) {
        el.setAttribute('style', cleanCss);
      }
    }

    if (name === 'href' || name === 'xlink:href') {
      if (isLinkable === undefined) {
        const localName = el.localName;
        isLinkable =
          localName === 'use' ||
          localName === 'image' ||
          equalsIgnoreCase(localName, 'feimage') ||
          localName === 'math' ||
          localName === 'maction';
      }
      if (isLinkable && attr.value && shouldStripHref(attr.value, policy)) {
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

  const walker = ownerDoc.createTreeWalker(root, 1 /* NodeFilter.SHOW_ELEMENT */);
  let el = walker.nextNode() as Element | null;
  let nodeCount = 0;

  while (el) {
    if (deadline !== undefined && ++nodeCount % TREEWALKER_CHECK_INTERVAL === 0) {
      checkDeadline(deadline, 'epub-sanitize', timeoutMs ?? SANITIZE_TIMEOUT_MS, traceId);
    }

    if (el.localName === 'style' && el.textContent) {
      el.textContent = sanitizeCssText(el.textContent, policy);
    }

    if (el.localName === 'annotation-xml') {
      const scripts = el.querySelectorAll('script');
      for (const script of scripts) {
        script.remove();
      }
    }

    if (el.hasAttributes()) {
      sanitizeElementAttributes(el, policy);
    }
    el = walker.nextNode() as Element | null;
  }
}

function collectHostInjectedNodes(doc: Document): NodeListOf<Element> | Element[] {
  return doc.head ? doc.head.querySelectorAll('[id^="epubjs-injected-"]') : [];
}

function rehomeHostInjectedNodes(doc: Document, hostNodes: Iterable<Element>): void {
  const head = doc.head;
  if (!head) return;
  for (const node of hostNodes) {
    if (node.id) doc.getElementById(node.id)?.remove();
    head.appendChild(node);
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

  const sanitized = DOMPurify.sanitize(root, {
    ALLOWED_TAGS: EPUB_ALLOWED_TAGS,
    ADD_ATTR: EPUB_ADD_ATTR,
    FORBID_ATTR: SVG_EVENT_ATTRS,
    RETURN_DOM: true,
    WHOLE_DOCUMENT: true,
  }) as Element;

  checkDeadline(deadline, 'epub-sanitize', timeoutMs, traceId);

  if (sanitized.localName === 'html') {
    const hostNodes = collectHostInjectedNodes(doc);
    root.replaceChildren(...sanitized.childNodes);
    for (let i = root.attributes.length - 1; i >= 0; i--) {
      const attr = root.attributes.item(i);
      if (attr) root.removeAttribute(attr.name);
    }
    const sanitizedAttrs = sanitized.attributes;
    for (let i = 0; i < sanitizedAttrs.length; i++) {
      const attr = sanitizedAttrs.item(i);
      if (attr) root.setAttribute(attr.name, attr.value);
    }
    rehomeHostInjectedNodes(doc, hostNodes);
  } else {
    root.replaceChildren(sanitized);
  }

  checkDeadline(deadline, 'epub-sanitize', timeoutMs, traceId);

  sanitizeDom(doc, deadline, timeoutMs, traceId, policy);
}

export interface SanitizeHook {
  hook: (contents: { document?: Document; href?: string }) => void;
}

export function createEpubSanitizerHook(options?: {
  timeoutMs?: number;
  traceId?: string;
  policyVersion?: number;
  externalUrlPolicy?: ExternalUrlPolicy;
}): SanitizeHook {
  const policyVersion = options?.policyVersion ?? SANITIZER_POLICY_VERSION;
  const policy = options?.externalUrlPolicy ?? DEFAULT_EXTERNAL_URL_POLICY;
  const cache = new Map<string, string>();

  function keyFor(href: string): string {
    return `${policyVersion}:${href}`;
  }

  function copyHtmlAttributesWhenChanged(target: HTMLElement, source: HTMLElement): void {
    for (let i = target.attributes.length - 1; i >= 0; i--) {
      const attr = target.attributes.item(i);
      if (attr && source.getAttribute(attr.name) === null) {
        target.removeAttribute(attr.name);
      }
    }
    const srcAttrs = source.attributes;
    for (let i = 0; i < srcAttrs.length; i++) {
      const attr = srcAttrs.item(i);
      if (attr) target.setAttribute(attr.name, attr.value);
    }
  }

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
        const hostNodes = collectHostInjectedNodes(doc);
        root.replaceChildren(...cachedRoot.childNodes);
        copyHtmlAttributesWhenChanged(root, cachedRoot);
        rehomeHostInjectedNodes(doc, hostNodes);
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

export function createSvgSanitizerHook(options?: {
  timeoutMs?: number;
  traceId?: string;
  externalUrlPolicy?: ExternalUrlPolicy;
}): (contents: { document?: Document }) => void {
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

export function buildExternalUrlCsp(policy: ExternalUrlPolicy): string {
  const origins: string[] = [];
  if (policy.mode === 'allowlist') {
    for (const entry of policy.hosts ?? []) {
      const host = parseHttpHost(entry.includes('://') ? entry : `https://${entry}`);
      if (host !== null) origins.push(`https://${host}`);
    }
  }
  const src = ["'self'", 'blob:', 'data:', ...origins].join(' ');
  const styleSrc = ["'self'", "'unsafe-inline'", 'blob:', 'data:', ...origins].join(' ');
  return [
    `img-src ${src}`,
    `style-src ${styleSrc}`,
    `font-src ${src}`,
    `media-src ${src}`,
    `connect-src ${"'self'" + (origins.length ? ` ${origins.join(' ')}` : '')}`,
    "object-src 'none'",
    "frame-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');
}

export interface ExternalUrlGuardHook {
  hook: (contents: { document?: Document } | Document) => void;
}

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
