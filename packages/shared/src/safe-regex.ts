export function matchBounded(re: RegExp, input: string, maxLen: number): RegExpExecArray | null {
  if (input.length > maxLen) return null;
  return re.exec(input);
}

export function testBounded(re: RegExp, input: string, maxLen: number): boolean {
  if (input.length > maxLen) return false;
  return re.test(input);
}

export function matchAllBounded(
  re: RegExp,
  input: string,
  maxLen: number,
): RegExpExecArray[] {
  if (input.length > maxLen) return [];
  return Array.from(input.matchAll(re));
}

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
