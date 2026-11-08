import DOMPurify from 'dompurify';

export function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const AUTHOR_ALLOWED_TAGS = [
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'div',
  'span',
  'blockquote',
  'pre',
  'code',
  'ul',
  'ol',
  'li',
  'dl',
  'dt',
  'dd',
  'table',
  'caption',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
  'a',
  'img',
  'em',
  'strong',
  'b',
  'i',
  'u',
  's',
  'sub',
  'sup',
  'figure',
  'figcaption',
  'hr',
  'br',
  'ruby',
  'rt',
  'rp',
];

const AUTHOR_ALLOWED_ATTR = [
  'href',
  'src',
  'alt',
  'title',
  'class',
  'id',
  'dir',
  'lang',
  'scope',
  'headers',
  'colspan',
  'rowspan',
];

function ensureSelfClosingXml(html: string): string {
  // Ensure void HTML tags are self-closed in XHTML: <br> -> <br />, <img> -> <img />
  return html.replace(/<(img|br|hr|col|source)([^>]*?)(?<!\/)>/gi, '<$1$2 />');
}

function escapeUnescapedAmpersands(xml: string): string {
  // Escape naked & not followed by a valid entity or character reference
  return xml.replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;');
}

function stripUnsafeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<button\b[^<]*(?:(?!<\/button>)<[^<]*)*<\/button>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<(object|embed|form|input|select)\b[^>]*>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*["']?\s*javascript:[^"'>]*/gi, '$1=""');
}

/**
 * Sanitizes chapter HTML into strict, safe XML Content Document body markup.
 * Strips all active content, scripts, styles, and unsafe event handlers.
 */
export function sanitizeChapterXhtml(rawContent: string): string {
  if (!rawContent || !rawContent.trim()) {
    return '<p></p>';
  }

  const cleaned =
    typeof DOMPurify?.sanitize === 'function'
      ? String(
          DOMPurify.sanitize(rawContent, {
            ALLOWED_TAGS: AUTHOR_ALLOWED_TAGS,
            ALLOWED_ATTR: AUTHOR_ALLOWED_ATTR,
            FORBID_TAGS: [
              'script',
              'style',
              'iframe',
              'object',
              'embed',
              'form',
              'input',
              'button',
            ],
            ALLOW_DATA_ATTR: false,
            RETURN_DOM: false,
          }),
        )
      : stripUnsafeHtml(rawContent);

  const selfClosed = ensureSelfClosingXml(cleaned);
  return escapeUnescapedAmpersands(selfClosed);
}
