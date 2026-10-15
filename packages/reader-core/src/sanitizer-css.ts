import {
  DEFAULT_EXTERNAL_URL_POLICY,
  shouldStripCssUrl,
  type ExternalUrlPolicy,
} from './sanitizer-url';

const MAX_CSS_TEXT_LENGTH = 1_048_576;

function isCssWhitespace(code: number): boolean {
  return code === 9 || code === 10 || code === 12 || code === 13 || code === 32;
}

function equalsAsciiIgnoreCase(source: string, offset: number, lower: string): boolean {
  if (offset + lower.length > source.length) return false;
  for (let index = 0; index < lower.length; index++) {
    if ((source.charCodeAt(offset + index) | 32) !== lower.charCodeAt(index)) return false;
  }
  return true;
}

function isCssNameCode(code: number): boolean {
  return (
    (code >= 48 && code <= 57) ||
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122) ||
    code === 45 ||
    code === 95 ||
    code >= 128
  );
}

function isCssNameStart(code: number): boolean {
  return (
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122) ||
    code === 45 ||
    code === 95 ||
    code === 92 ||
    code >= 128
  );
}

interface CssEscape {
  value: string;
  next: number;
}

function consumeCssEscape(source: string, offset: number): CssEscape {
  let cursor = offset + 1;
  if (cursor >= source.length) return { value: '', next: cursor };

  const code = source.charCodeAt(cursor);
  if (code === 10 || code === 12) return { value: '', next: cursor + 1 };
  if (code === 13) {
    return { value: '', next: source.charCodeAt(cursor + 1) === 10 ? cursor + 2 : cursor + 1 };
  }

  const isHex =
    (code >= 48 && code <= 57) || (code >= 65 && code <= 70) || (code >= 97 && code <= 102);
  if (!isHex) return { value: source.charAt(cursor), next: cursor + 1 };

  const start = cursor;
  let digits = 0;
  let value = 0;
  while (cursor < source.length && digits < 6) {
    const digit = source.charCodeAt(cursor);
    const hex =
      digit >= 48 && digit <= 57
        ? digit - 48
        : digit >= 65 && digit <= 70
          ? digit - 55
          : digit >= 97 && digit <= 102
            ? digit - 87
            : -1;
    if (hex < 0) break;
    value = value * 16 + hex;
    cursor++;
    digits++;
  }
  if (cursor === start) return { value: '', next: cursor };
  if (cursor < source.length && isCssWhitespace(source.charCodeAt(cursor))) {
    const wasCarriageReturn = source.charCodeAt(cursor) === 13;
    cursor++;
    if (wasCarriageReturn && source.charCodeAt(cursor) === 10) cursor++;
  }
  if (value === 0 || value > 0x10ffff || (value >= 0xd800 && value <= 0xdfff)) {
    return { value: '\uFFFD', next: cursor };
  }
  return { value: String.fromCodePoint(value), next: cursor };
}

function decodeCssEscapes(value: string): string {
  let decoded = '';
  for (let cursor = 0; cursor < value.length;) {
    if (value.charCodeAt(cursor) === 92) {
      const escape = consumeCssEscape(value, cursor);
      decoded += escape.value;
      cursor = escape.next;
    } else {
      decoded += value.charAt(cursor++);
    }
  }
  return decoded;
}

function readCssIdentifier(source: string, start: number): { value: string; next: number } {
  let cursor = start;
  let value = '';
  while (cursor < source.length) {
    const code = source.charCodeAt(cursor);
    if (isCssNameCode(code)) {
      value += source.charAt(cursor++);
    } else if (code === 92) {
      const escape = consumeCssEscape(source, cursor);
      value += escape.value;
      cursor = escape.next;
    } else {
      break;
    }
  }
  return { value, next: cursor };
}

function skipCssWhitespaceAndComments(source: string, start: number): number {
  let cursor = start;
  while (cursor < source.length) {
    if (isCssWhitespace(source.charCodeAt(cursor))) {
      cursor++;
      continue;
    }
    if (source.charCodeAt(cursor) === 47 && source.charCodeAt(cursor + 1) === 42) {
      cursor += 2;
      while (
        cursor < source.length &&
        !(source.charCodeAt(cursor) === 42 && source.charCodeAt(cursor + 1) === 47)
      ) {
        cursor++;
      }
      cursor = cursor < source.length ? cursor + 2 : source.length;
      continue;
    }
    break;
  }
  return cursor;
}

function readCssString(
  source: string,
  start: number,
): { contentStart: number; contentEnd: number; next: number } | null {
  const quote = source.charCodeAt(start);
  let cursor = start + 1;
  while (cursor < source.length) {
    const code = source.charCodeAt(cursor);
    if (code === 92) {
      cursor = consumeCssEscape(source, cursor).next;
    } else if (code === quote) {
      return { contentStart: start + 1, contentEnd: cursor, next: cursor + 1 };
    } else if (code === 10 || code === 12 || code === 13) {
      return null;
    } else {
      cursor++;
    }
  }
  return null;
}

function consumeCssUrl(
  source: string,
  openParen: number,
): { value: string; end: number; malformed: boolean } {
  let cursor = skipCssWhitespaceAndComments(source, openParen + 1);
  const quote = source.charCodeAt(cursor);
  if (quote === 34 || quote === 39) {
    const parsed = readCssString(source, cursor);
    if (!parsed) return { value: '', end: source.length, malformed: true };
    const value = decodeCssEscapes(source.slice(parsed.contentStart, parsed.contentEnd));
    cursor = skipCssWhitespaceAndComments(source, parsed.next);
    if (source.charCodeAt(cursor) === 41) return { value, end: cursor + 1, malformed: false };
    return { value: '', end: consumeThroughCssClose(source, cursor), malformed: true };
  }

  const contentStart = cursor;
  while (cursor < source.length) {
    const code = source.charCodeAt(cursor);
    if (code === 92) {
      cursor = consumeCssEscape(source, cursor).next;
    } else if (code === 41) {
      const rawValue = source.slice(contentStart, cursor).trim();
      return { value: decodeCssEscapes(rawValue), end: cursor + 1, malformed: false };
    } else if (isCssWhitespace(code)) {
      const afterWhitespace = skipCssWhitespaceAndComments(source, cursor);
      if (source.charCodeAt(afterWhitespace) === 41) {
        const rawValue = source.slice(contentStart, cursor).trim();
        return { value: decodeCssEscapes(rawValue), end: afterWhitespace + 1, malformed: false };
      }
      return { value: '', end: consumeThroughCssClose(source, afterWhitespace), malformed: true };
    } else if (
      code === 34 ||
      code === 39 ||
      code === 40 ||
      (code === 47 && source.charCodeAt(cursor + 1) === 42)
    ) {
      return { value: '', end: consumeThroughCssClose(source, cursor), malformed: true };
    } else {
      cursor++;
    }
  }
  return { value: '', end: source.length, malformed: true };
}

function consumeThroughCssClose(source: string, start: number): number {
  let cursor = start;
  while (cursor < source.length) {
    const code = source.charCodeAt(cursor);
    if (code === 92) {
      cursor = consumeCssEscape(source, cursor).next;
    } else if (code === 41) {
      return cursor + 1;
    } else {
      cursor++;
    }
  }
  return source.length;
}

function consumeCssAtRule(source: string, start: number): number {
  let cursor = start;
  let parenDepth = 0;
  while (cursor < source.length) {
    const code = source.charCodeAt(cursor);
    if (code === 34 || code === 39) {
      const parsed = readCssString(source, cursor);
      cursor = parsed?.next ?? source.length;
    } else if (code === 47 && source.charCodeAt(cursor + 1) === 42) {
      cursor = skipCssWhitespaceAndComments(source, cursor);
    } else if (code === 92) {
      cursor = consumeCssEscape(source, cursor).next;
    } else if (code === 40) {
      parenDepth++;
      cursor++;
    } else if (code === 41 && parenDepth > 0) {
      parenDepth--;
      cursor++;
    } else if (code === 59 && parenDepth === 0) {
      return cursor + 1;
    } else if (code === 125 && parenDepth === 0) {
      return cursor;
    } else {
      cursor++;
    }
  }
  return source.length;
}

function stripCssExpressions(cssText: string): string {
  const output: string[] = [];
  let copiedThrough = 0;
  let cursor = 0;

  while (cursor < cssText.length) {
    if (!equalsAsciiIgnoreCase(cssText, cursor, 'expression')) {
      cursor++;
      continue;
    }

    let openingParen = cursor + 10;
    while (openingParen < cssText.length && isCssWhitespace(cssText.charCodeAt(openingParen))) {
      openingParen++;
    }
    if (cssText.charCodeAt(openingParen) !== 40) {
      cursor = openingParen;
      continue;
    }

    output.push(cssText.slice(copiedThrough, cursor), 'none');
    let depth = 1;
    cursor = openingParen + 1;
    while (cursor < cssText.length && depth > 0) {
      const code = cssText.charCodeAt(cursor++);
      if (code === 40) depth++;
      else if (code === 41) depth--;
    }
    copiedThrough = cursor;
  }

  if (output.length === 0) return cssText;
  output.push(cssText.slice(copiedThrough));
  return output.join('');
}

function sanitizeCssUrls(cssText: string, policy: ExternalUrlPolicy): string {
  const output: string[] = [];
  let copiedThrough = 0;
  let cursor = 0;

  while (cursor < cssText.length) {
    const code = cssText.charCodeAt(cursor);
    if (code === 34 || code === 39) {
      const parsed = readCssString(cssText, cursor);
      cursor = parsed?.next ?? cssText.length;
      continue;
    }
    if (code === 47 && cssText.charCodeAt(cursor + 1) === 42) {
      cursor += 2;
      while (
        cursor < cssText.length &&
        !(cssText.charCodeAt(cursor) === 42 && cssText.charCodeAt(cursor + 1) === 47)
      ) {
        cursor++;
      }
      cursor = cursor < cssText.length ? cursor + 2 : cssText.length;
      continue;
    }
    if (code === 64 && isCssNameStart(cssText.charCodeAt(cursor + 1))) {
      const atRule = readCssIdentifier(cssText, cursor + 1);
      if (atRule.value.toLowerCase() === 'import') {
        const valueStart = skipCssWhitespaceAndComments(cssText, atRule.next);
        const valueCode = cssText.charCodeAt(valueStart);
        let importUrl: string | null = null;
        let importEnd: number | null = null;
        let malformedImport = false;

        if (valueCode === 34 || valueCode === 39) {
          const parsed = readCssString(cssText, valueStart);
          if (parsed) {
            importUrl = decodeCssEscapes(
              cssText.slice(parsed.contentStart, parsed.contentEnd),
            ).trim();
            importEnd = parsed.next;
          } else {
            malformedImport = true;
            importEnd = cssText.length;
          }
        } else {
          const importValue = readCssIdentifier(cssText, valueStart);
          if (
            importValue.value.toLowerCase() === 'url' &&
            cssText.charCodeAt(importValue.next) === 40
          ) {
            const parsed = consumeCssUrl(cssText, importValue.next);
            importUrl = parsed.value.trim();
            importEnd = parsed.end;
            malformedImport = parsed.malformed;
          }
        }

        if (
          importEnd !== null &&
          (malformedImport || (importUrl !== null && shouldStripCssUrl(importUrl, policy)))
        ) {
          const end = consumeCssAtRule(cssText, importEnd);
          output.push(cssText.slice(copiedThrough, cursor), '/* removed @import */');
          copiedThrough = end;
          cursor = end;
          continue;
        }
      }
      cursor++;
      continue;
    }
    if (isCssNameStart(code)) {
      const identifier = readCssIdentifier(cssText, cursor);
      if (identifier.value.toLowerCase() === 'url' && cssText.charCodeAt(identifier.next) === 40) {
        const parsed = consumeCssUrl(cssText, identifier.next);
        if (parsed.malformed || shouldStripCssUrl(parsed.value, policy)) {
          output.push(cssText.slice(copiedThrough, cursor), 'url("")');
          copiedThrough = parsed.end;
        }
        cursor = parsed.end;
        continue;
      }
      cursor = Math.max(cursor + 1, identifier.next);
      continue;
    }
    cursor++;
  }

  if (output.length === 0) return cssText;
  output.push(cssText.slice(copiedThrough));
  return output.join('');
}

/**
 * Sanitizes CSS text in style elements and inline style attributes. Oversized CSS
 * is discarded; malformed URL tokens are replaced without rescanning suffixes.
 */
export function sanitizeCssText(
  cssText: string,
  policy: ExternalUrlPolicy = DEFAULT_EXTERNAL_URL_POLICY,
): string {
  if (!cssText) return cssText;
  if (cssText.length > MAX_CSS_TEXT_LENGTH) return '';

  let sanitized = stripCssExpressions(cssText);
  sanitized = sanitized.replace(/-moz-binding\s*:[^;}]*/gi, '');
  return sanitizeCssUrls(sanitized, policy);
}
