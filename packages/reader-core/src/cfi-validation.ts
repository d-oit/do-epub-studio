const CFI_MAX_LENGTH = 1024;

/**
 * Conservative, platform-neutral validation for EPUB Canonical Fragment
 * Identifiers used when linking annotations into the appendix.
 *
 * Invalid or unsupported locators remain unresolved; this parser never guesses
 * a target. Callers additionally verify exact manifest and spine membership.
 */
export function isValidCfi(cfi: string): boolean {
  if (typeof cfi !== 'string' || cfi.length > CFI_MAX_LENGTH) return false;
  if (!cfi.startsWith('epubcfi(') || !cfi.endsWith(')')) return false;

  const body = cfi.slice(8, -1);
  if (body.length === 0 || body.length > CFI_MAX_LENGTH - 9 || !body.startsWith('/6/')) {
    return false;
  }
  if (!hasSafeCharacters(body)) return false;

  const spineStep = readDigits(body, 3);
  if (spineStep === null || spineStep.value < 2 || spineStep.value % 2 !== 0) {
    return false;
  }

  let contentStart = skipAssertion(body, spineStep.end);
  if (contentStart === null) return false;
  if (contentStart === body.length) return true;
  if (body.charAt(contentStart) !== '!') return false;
  contentStart++;
  if (body.charAt(contentStart) !== '/') return false;
  return isValidContentPath(body, contentStart);
}

function hasSafeCharacters(value: string): boolean {
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code < 0x20 || code === 0x7f || code === 0xfffe || code === 0xffff) return false;
    if (code >= 0xd800 && code <= 0xdbff) {
      const nextCode = value.charCodeAt(index + 1);
      if (nextCode < 0xdc00 || nextCode > 0xdfff) return false;
      index++;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return false;
    }
    if (code === 0x28 || code === 0x29) return false;
  }
  return true;
}

function readDigits(value: string, start: number): { end: number; value: number } | null {
  let end = start;
  while (end < value.length) {
    const code = value.charCodeAt(end);
    if (code < 0x30 || code > 0x39) break;
    end++;
  }
  if (end === start) return null;
  const number = Number(value.slice(start, end));
  if (!Number.isSafeInteger(number)) return null;
  return { end, value: number };
}

/** Skips one CFI assertion, returning null when its escaping or closing is invalid. */
function skipAssertion(value: string, start: number): number | null {
  if (value.charAt(start) !== '[') return start;
  for (let index = start + 1; index < value.length; index++) {
    const character = value.charAt(index);
    if (character === '^' || character === '\\') {
      if (index + 1 >= value.length) return null;
      index++;
    } else if (character === '[') {
      return null;
    } else if (character === ']') {
      return index + 1;
    }
  }
  return null;
}

function isValidContentPath(value: string, start: number): boolean {
  let cursor = start;
  let hasStep = false;

  while (cursor < value.length) {
    if (value.charAt(cursor) !== '/') return false;
    const step = readDigits(value, cursor + 1);
    if (step === null || step.value < 1) return false;
    hasStep = true;
    cursor = step.end;

    const stepAssertionEnd = skipAssertion(value, cursor);
    if (stepAssertionEnd === null) return false;
    cursor = stepAssertionEnd;

    if (value.charAt(cursor) === ':') {
      const offset = readDigits(value, cursor + 1);
      if (offset === null) return false;
      cursor = offset.end;
      const textAssertionEnd = skipAssertion(value, cursor);
      if (textAssertionEnd === null) return false;
      cursor = textAssertionEnd;
    }

    if (value.charAt(cursor) === ';') {
      if (
        value.charAt(cursor + 1) !== 's' ||
        value.charAt(cursor + 2) !== '=' ||
        (value.charAt(cursor + 3) !== 'a' && value.charAt(cursor + 3) !== 'b')
      ) {
        return false;
      }
      cursor += 4;
    }

    if (cursor === value.length) return hasStep;
    const separator = value.charAt(cursor);
    if (separator === '/') continue;
    if (separator === ',' || separator === '!') {
      cursor++;
      if (value.charAt(cursor) !== '/') return false;
      continue;
    }
    return false;
  }

  return hasStep;
}
