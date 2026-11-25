/**
 * Support helpers for the offline sync model harness (issue #1486).
 *
 * Extracted from `harness.ts` to keep that file under the 500-line cap: the
 * deterministic payload fingerprint used to match conflict bodies, and the
 * local IndexedDB reset performed between seeded runs.
 */
import { closeDb } from '../db';

/** Database name used by the app's IndexedDB layer. */
export const MODEL_DB_NAME = 'do-epub-studio';

/** Deterministic JSON fingerprint (sorted keys) used to match conflict payloads. */
export function fingerprint(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (typeof value === 'object' && value !== null) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      out[key] = sortKeys((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

/** Drop the local database so each seeded run starts from a clean device. */
export async function resetLocalDb(): Promise<void> {
  closeDb();
  const { promise, resolve } = Promise.withResolvers<void>();
  const req = indexedDB.deleteDatabase(MODEL_DB_NAME);
  req.onsuccess = () => resolve();
  req.onerror = () => resolve();
  req.onblocked = () => resolve();
  await promise;
}
