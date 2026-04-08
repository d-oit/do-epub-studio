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

export function cfiToRange(
  cfi: string,
): { spineIndex: number; path: string; charOffset: number } | null {
  const match = /epubcfi\(\/(\d+)(?:\[\S+\])?(!.*)?(?::(\d+))?\)/.exec(cfi);
  if (!match) return null;

  return {
    spineIndex: parseInt(match[1], 10),
    path: match[2] || '',
    charOffset: match[3] ? parseInt(match[3], 10) : 0,
  };
}

export function rangeToCfi(spineIndex: number, path: string, charOffset = 0): string {
  const pathPart = path || '';
  const offsetPart = charOffset > 0 ? `:${charOffset.toString()}` : '';
  return `epubcfi(/${spineIndex.toString()}${pathPart}${offsetPart})`;
}
