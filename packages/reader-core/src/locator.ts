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
  const { cfi, textExcerpt, chapterHref } = locator;
  // Optimize for the common case where fields do not contain characters that need JSON escaping.
  // This avoids JSON.stringify overhead during repetitive locator operations while maintaining correctness.
  if (
    cfi.indexOf('"') === -1 &&
    cfi.indexOf('\\') === -1 &&
    textExcerpt.indexOf('"') === -1 &&
    textExcerpt.indexOf('\\') === -1 &&
    chapterHref.indexOf('"') === -1 &&
    chapterHref.indexOf('\\') === -1
  ) {
    return `{"cfi":"${cfi}","textExcerpt":"${textExcerpt}","chapterHref":"${chapterHref}"}`;
  }
  return JSON.stringify(locator);
}

export function extractTextFromRange(range: Range, maxLength = 150): string {
  const text = range.toString().trim().replace(/\s+/g, ' ');
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - 3) + '...';
}
