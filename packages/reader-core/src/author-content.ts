import { html, parseFragment, type DefaultTreeAdapterMap } from 'parse5';

const AUTHOR_CONTENT_BASE = 'https://author-content.invalid/';
const SAFE_URL_ORIGIN = new URL(AUTHOR_CONTENT_BASE).origin;

const ALLOWED_TAGS = {
  p: true,
  h1: true,
  h2: true,
  h3: true,
  h4: true,
  h5: true,
  h6: true,
  div: true,
  span: true,
  blockquote: true,
  pre: true,
  code: true,
  ul: true,
  ol: true,
  li: true,
  dl: true,
  dt: true,
  dd: true,
  table: true,
  caption: true,
  thead: true,
  tbody: true,
  tfoot: true,
  tr: true,
  th: true,
  td: true,
  a: true,
  img: true,
  em: true,
  strong: true,
  b: true,
  i: true,
  u: true,
  s: true,
  sub: true,
  sup: true,
  figure: true,
  figcaption: true,
  hr: true,
  br: true,
  ruby: true,
  rt: true,
  rp: true,
} as const;

const DROP_CONTENT_TAGS = {
  button: true,
  embed: true,
  form: true,
  iframe: true,
  input: true,
  noscript: true,
  object: true,
  script: true,
  select: true,
  style: true,
  template: true,
  textarea: true,
} as const;

const COMMON_ATTRIBUTES = { class: true, dir: true, id: true, lang: true, title: true } as const;
const TABLE_CELL_ATTRIBUTES = { colspan: true, headers: true, rowspan: true } as const;
const AUTHOR_ASSET_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MAX_NESTED_AUTHOR_TAGS = 64;

type ParsedChild = DefaultTreeAdapterMap['childNode'];
type AuthorContentTag = keyof typeof ALLOWED_TAGS;
type AuthorContentAttributeName =
  | 'alt'
  | 'class'
  | 'colspan'
  | 'dir'
  | 'headers'
  | 'href'
  | 'id'
  | 'lang'
  | 'rowspan'
  | 'scope'
  | 'src'
  | 'title';

export interface AuthorContentAttribute {
  readonly name: AuthorContentAttributeName;
  readonly value: string;
}

export interface AuthorContentTextNode {
  readonly type: 'text';
  readonly value: string;
}

export interface AuthorContentElementNode {
  readonly type: 'element';
  readonly tag: AuthorContentTag;
  readonly attributes: readonly AuthorContentAttribute[];
  readonly children: readonly AuthorContentNode[];
}

export type AuthorContentNode = AuthorContentTextNode | AuthorContentElementNode;

function isTextNode(node: ParsedChild): node is DefaultTreeAdapterMap['textNode'] {
  return node.nodeName === '#text';
}

function isElementNode(node: ParsedChild): node is DefaultTreeAdapterMap['element'] {
  return 'tagName' in node;
}

function isAuthorContentTag(tag: string): tag is AuthorContentTag {
  return Object.hasOwn(ALLOWED_TAGS, tag);
}

function isSafeContentUrl(value: string, attribute: 'href' | 'src'): boolean {
  const candidate = value.trim();
  if (candidate.length === 0) return false;
  if (attribute === 'src') {
    return (
      candidate.startsWith('asset:') &&
      AUTHOR_ASSET_ID_PATTERN.test(candidate.slice('asset:'.length))
    );
  }

  try {
    const absolute = new URL(candidate);
    return absolute.protocol === 'mailto:';
  } catch {
    if (candidate.startsWith('//') || candidate.startsWith('\\')) return false;

    try {
      return new URL(candidate, AUTHOR_CONTENT_BASE).origin === SAFE_URL_ORIGIN;
    } catch {
      return false;
    }
  }
}

function getSafeAttributes(
  tag: AuthorContentTag,
  attrs: readonly { name: string; value: string }[],
): AuthorContentAttribute[] {
  const safe: AuthorContentAttribute[] = [];

  for (const attr of attrs) {
    if (Object.hasOwn(COMMON_ATTRIBUTES, attr.name)) {
      safe.push({ name: attr.name as AuthorContentAttributeName, value: attr.value });
      continue;
    }

    if (tag === 'a' && attr.name === 'href' && isSafeContentUrl(attr.value, 'href')) {
      safe.push({ name: 'href', value: attr.value });
      continue;
    }

    if (tag === 'img') {
      if (attr.name === 'alt') {
        safe.push({ name: 'alt', value: attr.value });
      } else if (attr.name === 'src' && isSafeContentUrl(attr.value, 'src')) {
        safe.push({ name: 'src', value: attr.value });
      }
      continue;
    }

    if (tag === 'th') {
      if (attr.name === 'scope') {
        safe.push({ name: 'scope', value: attr.value });
      } else if (Object.hasOwn(TABLE_CELL_ATTRIBUTES, attr.name)) {
        safe.push({ name: attr.name as AuthorContentAttributeName, value: attr.value });
      }
      continue;
    }

    if (tag === 'td' && Object.hasOwn(TABLE_CELL_ATTRIBUTES, attr.name)) {
      safe.push({ name: attr.name as AuthorContentAttributeName, value: attr.value });
    }
  }

  return safe;
}

interface SanitizerFrame {
  readonly nodes: readonly ParsedChild[];
  readonly output: AuthorContentNode[];
  readonly depth: number;
  index: number;
}

function sanitizeChildren(nodes: readonly ParsedChild[]): AuthorContentNode[] {
  const safe: AuthorContentNode[] = [];
  const stack: SanitizerFrame[] = [{ nodes, output: safe, depth: 0, index: 0 }];

  while (stack.length > 0) {
    const frame = stack[stack.length - 1];
    if (!frame) break;
    if (frame.index >= frame.nodes.length) {
      stack.pop();
      continue;
    }

    const node = frame.nodes[frame.index];
    frame.index++;
    if (!node) continue;

    if (isTextNode(node)) {
      frame.output.push({ type: 'text', value: node.value });
      continue;
    }

    if (!isElementNode(node) || node.namespaceURI !== html.NS.HTML) continue;

    const tag = node.tagName;
    if (Object.hasOwn(DROP_CONTENT_TAGS, tag)) continue;

    if (!isAuthorContentTag(tag) || frame.depth >= MAX_NESTED_AUTHOR_TAGS) {
      stack.push({ nodes: node.childNodes, output: frame.output, depth: frame.depth, index: 0 });
      continue;
    }

    const children: AuthorContentNode[] = [];
    frame.output.push({
      type: 'element',
      tag,
      attributes: getSafeAttributes(tag, node.attrs),
      children,
    });
    stack.push({ nodes: node.childNodes, output: children, depth: frame.depth + 1, index: 0 });
  }

  return safe;
}

/** Parses untrusted author HTML and returns an HTML-only, allowlisted content tree. */
export function parseAuthorContent(rawContent: string): AuthorContentNode[] {
  if (!rawContent) return [];
  return sanitizeChildren(parseFragment(rawContent).childNodes);
}
