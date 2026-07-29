export interface LocatorResult {
  cfi: string;
  textExcerpt: string;
  chapterHref: string;
}

export function createLocator(cfi: string, text: string, chapterHref: string): LocatorResult {
  return { cfi, textExcerpt: text, chapterHref };
}

export function parseLocator(locatorString: string): LocatorResult | null {
  if (
    locatorString.startsWith('{"cfi":"') &&
    locatorString.endsWith('"}')
  ) {
    const textExcerptKeyIdx = locatorString.indexOf('","textExcerpt":"', 8);
    if (textExcerptKeyIdx !== -1) {
      const chapterHrefKeyIdx = locatorString.indexOf('","chapterHref":"', textExcerptKeyIdx + 17);
      if (chapterHrefKeyIdx !== -1) {
        const cfi = locatorString.substring(8, textExcerptKeyIdx);
        const textExcerpt = locatorString.substring(textExcerptKeyIdx + 17, chapterHrefKeyIdx);
        const chapterHref = locatorString.substring(chapterHrefKeyIdx + 17, locatorString.length - 2);

        // Verify that none of the values contain double quotes or backslashes.
        // This ensures they don't have unescaped quotes or escapes that would
        // make them invalid JSON or change their parsed values under JSON.parse.
        if (
          cfi.indexOf('"') === -1 &&
          cfi.indexOf('\\') === -1 &&
          textExcerpt.indexOf('"') === -1 &&
          textExcerpt.indexOf('\\') === -1 &&
          chapterHref.indexOf('"') === -1 &&
          chapterHref.indexOf('\\') === -1
        ) {
          // Reconstruct to make absolutely sure the exact characters and structure match
          const reconstructed = `{"cfi":"${cfi}","textExcerpt":"${textExcerpt}","chapterHref":"${chapterHref}"}`;
          if (reconstructed === locatorString) {
            return { cfi, textExcerpt, chapterHref };
          }
        }
      }
    }
  }

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
