import { createElement, Fragment } from 'react';
import type { ReactNode } from 'react';
import type {
  AuthorContentAttribute,
  AuthorContentNode,
} from '@do-epub-studio/reader-core/author-content';
import type { PageDirection } from '../../stores';

/**
 * Preferred-reading-direction resolution shared by the author previews.
 *
 * An explicit reader override wins; otherwise the publication language decides,
 * with its primary subtag treated RTL for the languages EPUB reading systems
 * typically render right-to-left. All other languages default to LTR.
 */
const RTL_PRIMARY_SUBTAGS = new Set([
  'ar',
  'arc',
  'ckb',
  'dv',
  'fa',
  'he',
  'ks',
  'ps',
  'sd',
  'ug',
  'ur',
  'yi',
]);

export function resolvePreviewDirection(
  readerDirection: PageDirection,
  language?: string,
): 'ltr' | 'rtl' {
  if (readerDirection === 'ltr' || readerDirection === 'rtl') return readerDirection;
  const primary = language?.split(/[-_]/)[0]?.toLowerCase() ?? '';
  return RTL_PRIMARY_SUBTAGS.has(primary) ? 'rtl' : 'ltr';
}

/** Returns the unique `asset:` image ids referenced by a parsed content tree. */
export function collectAuthorImageAssetIds(nodes: readonly AuthorContentNode[]): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  const stack: AuthorContentNode[] = [...nodes].reverse();
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node || node.type !== 'element') continue;
    if (node.tag === 'img') {
      const src = node.attributes.find((attribute) => attribute.name === 'src')?.value;
      if (src?.startsWith('asset:')) {
        const id = src.slice('asset:'.length);
        if (!seen.has(id)) {
          seen.add(id);
          ids.push(id);
        }
      }
    }
    for (let i = node.children.length - 1; i >= 0; i--) {
      const child = node.children[i];
      if (child) stack.push(child);
    }
  }
  return ids;
}

export interface RenderAuthorPreviewOptions {
  /** Resolved object URL per asset id (fetched only when referenced). */
  assetUrls: ReadonlyMap<string, string>;
  /** Localized label when a referenced image is missing/unavailable. */
  missingImageLabel: string;
}

const ID_PREFIX = 'author-preview-';

function rewriteId(value: string): string {
  return `${ID_PREFIX}${value}`;
}

function rewriteHeaders(value: string): string {
  return value.split(/\s+/).filter(Boolean).map(rewriteId).join(' ');
}

/**
 * Maps safe parser attributes to React element props. Author-authored `class`
 * values are dropped to prevent Tailwind/app-style collisions; `id` and table
 * `headers` references are rewritten under the preview namespace so they can
 * never collide with the host document.
 */
function buildElementProps(
  attributes: readonly AuthorContentAttribute[],
): Record<string, string | number> | undefined {
  let props: Record<string, string | number> | undefined;
  for (const attribute of attributes) {
    const { name, value } = attribute;
    if (name === 'class' || name === 'src' || name === 'href' || name === 'alt') continue;
    let key: string;
    let next: string;
    switch (name) {
      case 'colspan':
        key = 'colSpan';
        next = value;
        break;
      case 'rowspan':
        key = 'rowSpan';
        next = value;
        break;
      case 'headers':
        key = 'headers';
        next = rewriteHeaders(value);
        break;
      case 'id':
        key = 'id';
        next = rewriteId(value);
        break;
      default:
        key = name;
        next = value;
        break;
    }
    props ??= {};
    props[key] = next;
  }
  return props;
}

function renderNode(node: AuthorContentNode, options: RenderAuthorPreviewOptions): ReactNode {
  if (node.type === 'text') return node.value;

  const { tag, attributes, children } = node;
  const renderChildren = () => children.map((child) => renderNode(child, options));

  if (tag === 'a') {
    const href = attributes.find((attribute) => attribute.name === 'href')?.value;
    // mailto and local fragment links stay active; every other relative link is
    // rendered as inert text (HTTP(S) links never survive the parser).
    if (href?.startsWith('#')) {
      return createElement(
        'a',
        { ...(buildElementProps(attributes) ?? {}), href: `#${rewriteId(href.slice(1))}` },
        ...renderChildren(),
      );
    }
    if (href?.toLowerCase().startsWith('mailto:')) {
      return createElement(
        'a',
        { ...(buildElementProps(attributes) ?? {}), href },
        ...renderChildren(),
      );
    }
    return createElement(Fragment, null, ...renderChildren());
  }

  if (tag === 'img') {
    const alt = attributes.find((attribute) => attribute.name === 'alt')?.value ?? '';
    const src = attributes.find((attribute) => attribute.name === 'src')?.value;
    const assetId = src?.startsWith('asset:') ? src.slice('asset:'.length) : undefined;
    const url = assetId ? options.assetUrls.get(assetId) : undefined;
    if (!url) {
      const label = alt || options.missingImageLabel;
      return createElement(
        'span',
        {
          className:
            'author-preview-missing-image inline-block rounded-sm border border-border bg-background-tertiary px-2 py-1 text-sm text-foreground-muted',
          role: 'img',
          'aria-label': label,
        },
        label,
      );
    }
    return createElement('img', { src: url, alt });
  }

  return createElement(tag, buildElementProps(attributes), ...renderChildren());
}

/** Renders a parsed author content tree as safe React elements (no innerHTML). */
export function renderAuthorPreviewContent(
  nodes: readonly AuthorContentNode[],
  options: RenderAuthorPreviewOptions,
): ReactNode {
  return createElement(Fragment, null, ...nodes.map((node) => renderNode(node, options)));
}
