/**
 * Applying sanitized EPUB markup to a live epub.js document.
 *
 * Kept out of `sanitizer.ts` (ADR-278 shrink-only ratchet): these helpers are
 * about document identity, not about the sanitization policy itself.
 */

/**
 * Mirror every attribute of `source` onto `target`, dropping stale ones.
 */
export function copyElementAttributes(target: Element, source: Element): void {
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

/**
 * epub.js tracks its own host-side injections — theme/style/script nodes with
 * ids like `epubjs-injected-css-*` / `epubjs-injected-src-*` — in per-Contents
 * Maps and later removes them via `document.head.removeChild(node)`. Replacing
 * the live `<head>` element's children detaches those nodes while the Map still
 * references them, so the next theme/stylesheet pass throws NotFoundError
 * (removeChild on a non-child). StrictMode's double reader mount and any
 * resize/re-display hit this immediately.
 *
 * These nodes are created by the host (theme applier, CSP guard), never by
 * EPUB content, so preserving them BY IDENTITY across the splice does not
 * weaken sanitization: EPUB-controlled markup is still fully rebuilt from the
 * sanitized clone; only trusted host nodes are re-homed.
 */
export function collectHostInjectedNodes(doc: Document): NodeListOf<Element> | Element[] {
  return doc.head ? doc.head.querySelectorAll('[id^="epubjs-injected-"]') : [];
}

export function rehomeHostInjectedNodes(doc: Document, hostNodes: Iterable<Element>): void {
  const head = doc.head;
  if (!head) return;
  for (const node of hostNodes) {
    if (node.id) doc.getElementById(node.id)?.remove();
    head.appendChild(node);
  }
}

/**
 * Replace the live document's markup with the sanitized clone's markup without
 * replacing the `<head>`/`<body>` elements themselves.
 *
 * epub.js builds `Contents` in the view's `onLoad` — before content hooks run —
 * and keeps `Contents.content = document.body`. Replacing `<html>`'s children
 * detaches that captured body, so `Contents.textSize()` measures a detached
 * node (0×0) and `expand()` reframes the view to zero; `Contents.range()` can
 * no longer anchor a locator. EPUB markup is still fully rebuilt from the
 * clone — only the two container elements survive, with attributes synced.
 *
 * Returns false when the live document has no head/body pair to splice into, so
 * callers can fall back to replacing `<html>`'s children.
 */
export function spliceSanitizedContent(doc: Document, source: Element): boolean {
  const root = doc.documentElement;
  const liveHead = doc.head;
  const liveBody = doc.body;
  const sourceHead = source.querySelector('head');
  const sourceBody = source.querySelector('body');
  if (!root || !liveHead || !liveBody || !sourceHead || !sourceBody) return false;

  copyElementAttributes(root, source);
  liveHead.replaceChildren(...sourceHead.childNodes);
  copyElementAttributes(liveHead, sourceHead);
  liveBody.replaceChildren(...sourceBody.childNodes);
  copyElementAttributes(liveBody, sourceBody);
  return true;
}
