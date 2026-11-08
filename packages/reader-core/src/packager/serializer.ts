import { parseAuthorContent, type AuthorContentNode } from '../author-content';

const XML_VOID_TAGS = { br: true, hr: true, img: true } as const;

export function escapeXml(value: string): string {
  const escaped: string[] = [];
  let segmentStart = 0;

  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    let replacement: string | null = null;

    switch (code) {
      case 0x26:
        replacement = '&amp;';
        break;
      case 0x3c:
        replacement = '&lt;';
        break;
      case 0x3e:
        replacement = '&gt;';
        break;
      case 0x22:
        replacement = '&quot;';
        break;
      case 0x27:
        replacement = '&apos;';
        break;
      default:
        if (code >= 0xd800 && code <= 0xdbff) {
          const nextCode = value.charCodeAt(index + 1);
          if (nextCode >= 0xdc00 && nextCode <= 0xdfff) {
            index++;
            continue;
          }
          replacement = '\uFFFD';
        } else if (
          (code >= 0xdc00 && code <= 0xdfff) ||
          (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) ||
          code === 0xfffe ||
          code === 0xffff
        ) {
          replacement = '\uFFFD';
        }
    }

    if (replacement !== null) {
      escaped.push(value.slice(segmentStart, index), replacement);
      segmentStart = index + 1;
    }
  }

  if (escaped.length === 0) return value;
  escaped.push(value.slice(segmentStart));
  return escaped.join('');
}

function serializeAuthorNode(node: AuthorContentNode): string {
  if (node.type === 'text') return escapeXml(node.value);

  let attributes = '';
  for (const attribute of node.attributes) {
    attributes += ` ${attribute.name}="${escapeXml(attribute.value)}"`;
  }

  if (Object.hasOwn(XML_VOID_TAGS, node.tag)) return `<${node.tag}${attributes} />`;

  return `<${node.tag}${attributes}>${serializeAuthorNodes(node.children)}</${node.tag}>`;
}

function serializeAuthorNodes(nodes: readonly AuthorContentNode[]): string {
  const serialized: string[] = [];
  for (const node of nodes) serialized.push(serializeAuthorNode(node));
  return serialized.join('');
}

/** Converts untrusted author HTML to well-formed, allowlisted XHTML body markup. */
export function sanitizeChapterXhtml(rawContent: string): string {
  if (!rawContent || !rawContent.trim()) return '<p></p>';
  return serializeAuthorNodes(parseAuthorContent(rawContent)) || '<p></p>';
}
