/**
 * AI opt-in consent gate (issue #318, GOAP-318).
 *
 * AI features are off by default. A capability may run only after the user
 * explicitly opts in; the choice is persisted via an injectable storage
 * adapter so tests and non-browser environments stay deterministic.
 *
 * Local-first invariant: the gate is the ONLY way to unlock inference.
 * There is no silent/background AI path.
 */

export interface AiConsentStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const CONSENT_KEY = 'reader-ai:opt-in';

/** Storage that always reports "not opted in" (non-browser default). */
const noOpStorage: AiConsentStorage = {
  getItem: () => null,
  setItem: () => {
    /* no-op */
  },
};

let storage: AiConsentStorage =
  typeof globalThis.localStorage !== 'undefined' ? globalThis.localStorage : noOpStorage;

/** In-memory fallback when the storage adapter throws (e.g. privacy mode). */
let memoryConsent: string | null = null;

/**
 * Inject the consent storage (tests, or apps that prefer a different
 * persistence layer). Call before the first `isAiEnabled()` if needed.
 */
export function configureAiConsentStorage(next: AiConsentStorage): void {
  storage = next;
  memoryConsent = null;
}

/** Whether the user has opted in to AI features (default: false). */
export function isAiEnabled(): boolean {
  try {
    return storage.getItem(CONSENT_KEY) === '1';
  } catch {
    return memoryConsent === '1';
  }
}

/** Persist the user's AI opt-in choice. */
export function setAiEnabled(enabled: boolean): void {
  const value = enabled ? '1' : '0';
  try {
    storage.setItem(CONSENT_KEY, value);
  } catch {
    memoryConsent = value;
  }
}
