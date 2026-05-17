export function matchBounded(re: RegExp, input: string, maxLen: number): RegExpExecArray | null {
  if (input.length > maxLen) return null;
  return re.exec(input);
}

export function testBounded(re: RegExp, input: string, maxLen: number): boolean {
  if (input.length > maxLen) return false;
  return re.test(input);
}