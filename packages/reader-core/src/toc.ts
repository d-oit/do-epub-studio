import type { TocItem } from './epub-types';

export function flattenToc(toc: TocItem[]): TocItem[] {
  const result: TocItem[] = [];

  function walk(items: TocItem[]) {
    for (const item of items) {
      result.push(item);
      if (item.subitems) {
        walk(item.subitems);
      }
    }
  }

  walk(toc);
  return result;
}

export function findTocItemByHref(toc: TocItem[], href: string): TocItem | null {
  for (const item of toc) {
    if (item.href === href) return item;
    if (item.subitems) {
      const found = findTocItemByHref(item.subitems, href);
      if (found) return found;
    }
  }
  return null;
}

export function getTocPath(toc: TocItem[], targetHref: string): TocItem[] {
  const path: TocItem[] = [];

  function walk(items: TocItem[]): boolean {
    for (const item of items) {
      path.push(item);
      if (item.href === targetHref) return true;
      if (item.subitems && walk(item.subitems)) return true;
      path.pop();
    }
    return false;
  }

  walk(toc);
  return path;
}

export function buildTocHierarchy(flatItems: { label: string; href: string; level?: number }[]): TocItem[] {
  const root: TocItem[] = [];
  const stack: TocItem[] = [];

  for (const item of flatItems) {
    const tocItem: TocItem = { id: crypto.randomUUID(), label: item.label, href: item.href };
    const level = item.level ?? 0;

    while (stack.length > level) {
      stack.pop();
    }

    if (stack.length === 0) {
      root.push(tocItem);
    } else {
      const parent = stack[stack.length - 1];
      parent.subitems = parent.subitems || [];
      parent.subitems.push(tocItem);
    }

    stack.push(tocItem);
  }

  return root;
}
