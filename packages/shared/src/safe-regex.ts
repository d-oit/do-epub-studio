/**
 * Execute a regex against `input`, but only if the input is within `maxLen`.
 * Prevents catastrophic backtracking on untrusted strings.
 *
 * @param re - Regular expression to test.
 * @param input - String to match against.
 * @param maxLen - Maximum allowed input length; returns null if exceeded.
 * @returns First match or null.
 */
export function matchBounded(re: RegExp, input: string, maxLen: number): RegExpExecArray | null {
  if (input.length > maxLen) return null;
  return re.exec(input);
}

/**
 * Test a regex against `input`, returning a boolean, bounded by `maxLen`.
 * Use instead of `RegExp.test()` on untrusted input.
 *
 * @param re - Regular expression to test.
 * @param input - String to match against.
 * @param maxLen - Maximum allowed input length; returns false if exceeded.
 * @returns Whether the pattern matches.
 */
export function testBounded(re: RegExp, input: string, maxLen: number): boolean {
  if (input.length > maxLen) return false;
  return re.test(input);
}

/**
 * Return all regex matches in `input`, bounded by `maxLen`.
 * Use instead of `String.matchAll()` on untrusted input.
 *
 * @param re - Regular expression (should include `g` flag).
 * @param input - String to match against.
 * @param maxLen - Maximum allowed input length; returns empty array if exceeded.
 * @returns Array of all match results.
 */
export function matchAllBounded(
  re: RegExp,
  input: string,
  maxLen: number,
): RegExpExecArray[] {
  if (input.length > maxLen) return [];
  return Array.from(input.matchAll(re));
}

/**
 * Escape all regex metacharacters in `s` so it can be used as a literal pattern.
 *
 * @param s - Raw string to escape.
 * @returns Escaped string safe for use in a RegExp constructor.
 */
export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
