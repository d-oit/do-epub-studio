import DOMPurify from 'dompurify';

/**
 * Sanitizes an EPUB Document object in-place using DOMPurify.
 * Also injects a strict Content Security Policy (CSP) meta tag.
 *
 * @param doc The Document object to sanitize.
 */
export function sanitizeEpubDocument(doc: Document): void {
  // 1. Sanitize document content
  // We sanitize the documentElement with WHOLE_DOCUMENT: true to preserve
  // the overall structure while stripping dangerous content.
  if (doc.documentElement) {
    DOMPurify.sanitize(doc.documentElement, {
      IN_PLACE: true,
      WHOLE_DOCUMENT: true,
    });
  }

  // 2. Inject strict CSP meta tag
  // We do this after sanitization to ensure the meta tag itself is not removed.
  // The CSP is relaxed slightly to allow blob: for styles and fonts, as EPUBs
  // often use blob URIs for these resources.
  let head = doc.head || doc.getElementsByTagName('head')[0];
  if (!head && doc.documentElement) {
    head = doc.createElement('head');
    doc.documentElement.insertBefore(head, doc.documentElement.firstChild);
  }

  if (head) {
    const meta = doc.createElement('meta');
    meta.setAttribute('http-equiv', 'Content-Security-Policy');
    meta.setAttribute('content', "default-src 'none'; script-src 'none'; style-src 'unsafe-inline' blob:; font-src blob:; img-src data: blob: http: https:;");
    head.insertBefore(meta, head.firstChild);
  }
}
