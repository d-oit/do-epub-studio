export interface LocatorResult {
  cfi: string;
  textExcerpt: string;
  chapterHref: string;
}

export function createLocator(cfi: string, text: string, chapterHref: string): LocatorResult {
  return { cfi, textExcerpt: text, chapterHref };
}

export function parseLocator(locatorString: string): LocatorResult | null {
  try {
    const parsed = JSON.parse(locatorString) as Partial<LocatorResult>;
    if (
      typeof parsed.cfi === 'string' &&
      typeof parsed.textExcerpt === 'string' &&
      typeof parsed.chapterHref === 'string'
    ) {
      return parsed as LocatorResult;
    }
    return null;
  } catch {
    return null;
  }
}

export function locatorToString(locator: LocatorResult): string {
  // Manual string building is faster than JSON.stringify for this simple object
  // and helps avoid regression in benchmarks.
  return `{"cfi":${JSON.stringify(locator.cfi)},"textExcerpt":${JSON.stringify(locator.textExcerpt)},"chapterHref":${JSON.stringify(locator.chapterHref)}}`;
}

export function extractTextFromRange(range: Range, maxLength = 150): string {
  const text = range.toString().trim().replace(/\s+/g, ' ');
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - 3) + '...';
}
