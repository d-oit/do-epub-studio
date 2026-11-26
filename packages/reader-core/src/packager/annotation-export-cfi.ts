function isAsciiCfiCharacter(character: string): boolean {
  const code = character.charCodeAt(0);
  return (
    code >= 0x20 &&
    code <= 0x7e &&
    character !== '<' &&
    character !== '>' &&
    character !== '"' &&
    character !== "'" &&
    character !== '#' &&
    character !== '%' &&
    character !== '?' &&
    character !== '\\'
  );
}

function parseAssertion(value: string, start: number): number | null {
  let index = start + 1;
  while (index < value.length) {
    const character = value[index] as string;
    if (!isAsciiCfiCharacter(character)) return null;
    if (character === '^') {
      index += 1;
      if (index >= value.length || '[](),;=^'.indexOf(value[index] as string) < 0) return null;
      index += 1;
      continue;
    }
    if (character === '[') return null;
    if (character === ']') return index + 1;
    index += 1;
  }
  return null;
}

function parseCfiPath(value: string): boolean {
  if (!value.startsWith('/')) return false;
  let index = 0;
  let stepCount = 0;
  while (index < value.length) {
    if (value[index] !== '/') return false;
    index += 1;
    const stepStart = index;
    while (index < value.length) {
      const digit = value.charCodeAt(index) - 48;
      if (digit < 0 || digit > 9) break;
      index += 1;
    }
    if (index === stepStart) return false;
    stepCount += 1;
    if (value[index] === '[') {
      const afterAssertion = parseAssertion(value, index);
      if (afterAssertion === null) return false;
      index = afterAssertion;
    }
    if (value[index] === ':') {
      index += 1;
      const offsetStart = index;
      while (index < value.length) {
        const digit = value.charCodeAt(index) - 48;
        if (digit < 0 || digit > 9) break;
        index += 1;
      }
      if (index === offsetStart) return false;
    }
    if (value[index] === '[') {
      const afterAssertion = parseAssertion(value, index);
      if (afterAssertion === null) return false;
      index = afterAssertion;
    }
    if (index < value.length && value[index] !== '/') return false;
  }
  return stepCount > 0;
}

function parseSpineStep(
  packagePath: string,
  spineStep: number,
): { index: number; assertion: string | null } | null {
  const prefix = `/${spineStep}/`;
  if (!packagePath.startsWith(prefix)) return null;
  let index = prefix.length;
  const start = index;
  let value = 0;
  while (index < packagePath.length) {
    const digit = packagePath.charCodeAt(index) - 48;
    if (digit < 0 || digit > 9) break;
    value = value * 10 + digit;
    index += 1;
  }
  if (index === start || value < 2 || value % 2 !== 0) return null;
  let assertion: string | null = null;
  if (packagePath[index] === '[') {
    const afterAssertion = parseAssertion(packagePath, index);
    if (afterAssertion === null) return null;
    assertion = packagePath.slice(index + 1, afterAssertion - 1);
    index = afterAssertion;
  }
  if (index !== packagePath.length) return null;
  return { index: value / 2 - 1, assertion };
}

export interface CfiSpineParse {
  /** Zero-based index of the targeted spine item. */
  index: number;
  /** CFI assertion on the spine item step, if present (`[id]`). */
  assertion: string | null;
  /** CFI text after the spine item step, including a leading `!` when present. */
  remainder: string;
}

export function parseCfiSpine(cfi: string | null | undefined, spineStep = 6): CfiSpineParse | null {
  if (!cfi || cfi.length > 2048 || !cfi.startsWith('epubcfi(') || !cfi.endsWith(')')) return null;
  const body = cfi.slice(8, -1);
  let bracketDepth = 0;
  let escaped = false;
  let bang = -1;
  const commas: number[] = [];
  for (let index = 0; index < body.length; index += 1) {
    const character = body[index] as string;
    if (!isAsciiCfiCharacter(character)) return null;
    if (escaped) {
      if ('[](),;=^'.indexOf(character) < 0) return null;
      escaped = false;
      continue;
    }
    if (character === '^') {
      if (bracketDepth === 0) return null;
      escaped = true;
      continue;
    }
    if (character === '[') {
      if (bracketDepth !== 0) return null;
      bracketDepth = 1;
      continue;
    }
    if (character === ']') {
      if (bracketDepth !== 1) return null;
      bracketDepth = 0;
      continue;
    }
    if (bracketDepth !== 0) continue;
    if (character === '!') {
      if (bang !== -1) return null;
      bang = index;
    } else if (character === ',') {
      commas.push(index);
    }
  }
  if (escaped || bracketDepth !== 0 || (commas.length !== 0 && commas.length !== 2)) {
    return null;
  }
  if (commas.length !== 0 && bang < 0) return null;

  const packagePath = bang >= 0 ? body.slice(0, bang) : body;
  const parsed = parseSpineStep(packagePath, spineStep);
  if (parsed === null || !parseCfiPath(packagePath)) return null;
  if (bang >= 0) {
    const firstRange = commas.length > 0 ? (commas[0] as number) : body.length;
    if (!parseCfiPath(body.slice(bang + 1, firstRange))) return null;
    if (commas.length === 2) {
      const secondRange = commas[1] as number;
      if (!parseCfiPath(body.slice(firstRange + 1, secondRange))) return null;
      if (!parseCfiPath(body.slice(secondRange + 1))) return null;
    }
  }
  return {
    index: parsed.index,
    assertion: parsed.assertion,
    remainder: bang >= 0 ? body.slice(bang) : '',
  };
}

export function parseCfiSpineIndex(cfi: string | null | undefined, spineStep = 6): number | null {
  return parseCfiSpine(cfi, spineStep)?.index ?? null;
}
