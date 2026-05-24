import DOMPurify from 'dompurify';

/**
 * Sanitizes an EPUB document in-place using DOMPurify.
 * This is designed to be used as a content hook for @intity/epub-js.
 *
 * It strictly filters SVG content to prevent XSS while allowing safe elements.
 * foreignObject elements are explicitly stripped as they can contain arbitrary HTML/scripts.
 *
 * @param doc The document or element to sanitize
 */
export function sanitizeEpubDocument(doc: Document | HTMLElement): void {
  const root = doc instanceof Document ? doc.documentElement : doc;

  DOMPurify.sanitize(root, {
    IN_PLACE: true,
    WHOLE_DOCUMENT: doc instanceof Document,
    // Explicitly allow SVG namespace and common tags
    USE_PROFILES: { html: true, svg: true },
    // Explicitly block dangerous SVG features that might be allowed by default profiles
    FORBID_TAGS: ['script', 'foreignObject', 'animate', 'set', 'animateMotion', 'animateTransform'],
    // Ensure all event handlers are stripped
    FORBID_ATTR: ['on*'],
  });
}
