import DOMPurify from 'dompurify';

/**
 * Sanitizes an EPUB Document object in-place using DOMPurify.
 * Also injects a strict Content Security Policy (CSP) meta tag.
 *
 * @param doc The Document object to sanitize.
 */
export function sanitizeEpubDocument(doc: Document): void {
  const root = doc.documentElement;
  if (!root) return;

  DOMPurify.sanitize(root, {
    IN_PLACE: true,
    WHOLE_DOCUMENT: true,
  });

  let head = doc.head || doc.getElementsByTagName('head')[0];
  if (!head) {
    head = doc.createElement('head');
    root.insertBefore(head, root.firstChild);
  }

  const meta = doc.createElement('meta');
  meta.setAttribute('http-equiv', 'Content-Security-Policy');
  meta.setAttribute('content', "default-src 'none'; script-src 'none'; style-src 'unsafe-inline' blob:; font-src blob:; img-src data: blob: http: https:;");
  head.insertBefore(meta, head.firstChild);
}
