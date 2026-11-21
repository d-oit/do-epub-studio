/**
 * Minimal canonical runtime guard helpers for the offline storage layer.
 *
 * Values persisted by our own code through IndexedDB may still be malformed
 * across app versions; these guards narrow `unknown` to a dictionary so field
 * checks can be done with `typeof`/`Array.isArray` on the named shape.
 */

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
