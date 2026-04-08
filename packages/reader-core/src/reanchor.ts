import type { TocItem } from './epub-types';
import type { LocatorResult } from './locator';

export interface ReanchorResult {
  success: boolean;
  cfi?: string;
  chapterHref?: string;
  fallback: boolean;
  message?: string;
}

export async function reanchorByText(
  targetText: string,
  toc: TocItem[],
  loadChapterContent: (href: string) => Promise<string>,
): Promise<ReanchorResult> {
  if (targetText.length < 10) {
    return { success: false, fallback: true, message: 'Text too short for reanchoring' };
  }

  for (const item of toc) {
    try {
      const content = await loadChapterContent(item.href);
      const normalizedContent = content.toLowerCase();
      const normalizedTarget = targetText.toLowerCase();

      const index = normalizedContent.indexOf(normalizedTarget);
      if (index !== -1) {
        return {
          success: true,
          chapterHref: item.href,
          fallback: false,
        };
      }

      if (item.subitems) {
        for (const subitem of item.subitems) {
          const subContent = await loadChapterContent(subitem.href);
          const subIndex = subContent.toLowerCase().indexOf(normalizedTarget);
          if (subIndex !== -1) {
            return {
              success: true,
              chapterHref: subitem.href,
              fallback: false,
            };
          }
        }
      }
    } catch {
      continue;
    }
  }

  return {
    success: false,
    fallback: true,
    message: 'Could not find target text in any chapter',
  };
}

export function findBestChapterMatch(locator: LocatorResult, toc: TocItem[]): TocItem | null {
  if (!locator.chapterHref) return null;

  const found = toc.find((item) => item.href === locator.chapterHref);
  if (found) return found;

  for (const item of toc) {
    if (item.subitems) {
      const subFound = item.subitems.find((sub) => sub.href === locator.chapterHref);
      if (subFound) return subFound;
    }
  }

  return toc[0] || null;
}
