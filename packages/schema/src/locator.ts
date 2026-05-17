import type { AnnotationLocator } from './types';

export function createLocator(params: Partial<AnnotationLocator>): AnnotationLocator {
  return {
    cfi: params.cfi,
    selectedText: params.selectedText,
    chapterRef: params.chapterRef,
    elementIndex: params.elementIndex,
    charOffset: params.charOffset,
  };
}

export function locatorToJson(locator: AnnotationLocator): string {
  return JSON.stringify(locator);
}

export function locatorFromJson(json: string): AnnotationLocator {
  return JSON.parse(json) as AnnotationLocator;
}

export function hasCfi(locator: AnnotationLocator): boolean {
  return typeof locator.cfi === 'string' && locator.cfi.length > 0;
}

export function hasSelectedText(locator: AnnotationLocator): boolean {
  return typeof locator.selectedText === 'string' && locator.selectedText.length >= 10;
}

export function isValidLocator(locator: AnnotationLocator): boolean {
  return hasCfi(locator) || hasSelectedText(locator);
}

export function extractTextExcerpt(text: string, maxLength = 100): string {
  const cleaned = text.trim().replace(/\s+/g, ' ');
  if (cleaned.length <= maxLength) {
    return cleaned;
  }
  return cleaned.substring(0, maxLength - 3) + '...';
}

export function cfiToRange(cfi: string): { spineIndex: number; path: string; charOffset: number } | null {
  if (cfi.length > 1024) return null;
  const spineMatch = cfi.match(/epubcfi\(\/(\d+)/);
  if (!spineMatch) return null;
  const spineIndex = parseInt(spineMatch[1]!, 10);

  const pathPart = cfi.includes('[') ? cfi.match(/\[([^\]]{0,256})\]/)?.[1] : '';
  const suffix = cfi.includes(':') ? cfi.match(/:(\d+)\)/) : null;
  const charOffset = suffix ? parseInt(suffix[1]!, 10) : 0;

  return { spineIndex, path: pathPart ? `[${pathPart}]` : '', charOffset };
}

export function rangeToCfi(spineIndex: number, path: string, charOffset = 0): string {
  const pathPart = path || '';
  const offsetPart = charOffset > 0 ? `:${charOffset.toString()}` : '';
  return `epubcfi(/${spineIndex.toString()}${pathPart}${offsetPart})`;
}
