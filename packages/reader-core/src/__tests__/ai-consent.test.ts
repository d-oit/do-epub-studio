import { beforeEach, describe, expect, it } from 'vitest';

import {
  configureAiConsentStorage,
  isAiEnabled,
  setAiEnabled,
  type AiConsentStorage,
} from '../ai';

interface FakeStorage extends AiConsentStorage {
  data: Map<string, string>;
}

function fakeStorage(): FakeStorage {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string): string | null => data.get(key) ?? null,
    setItem: (key: string, value: string): void => {
      data.set(key, value);
    },
  };
}

describe('AI consent gate', () => {
  let storage: FakeStorage;

  beforeEach(() => {
    storage = fakeStorage();
    configureAiConsentStorage(storage);
  });

  it('is disabled by default (no stored choice)', () => {
    expect(isAiEnabled()).toBe(false);
  });

  it('enables after explicit opt-in and persists the choice', () => {
    setAiEnabled(true);
    expect(isAiEnabled()).toBe(true);
    expect(storage.data.get('reader-ai:opt-in')).toBe('1');
  });

  it('disables again after explicit opt-out', () => {
    setAiEnabled(true);
    setAiEnabled(false);
    expect(isAiEnabled()).toBe(false);
    expect(storage.data.get('reader-ai:opt-in')).toBe('0');
  });

  it('treats a throwing storage as not enabled, and keeps the in-memory choice', () => {
    let fail = false;
    configureAiConsentStorage({
      getItem: () => {
        if (fail) throw new Error('storage blocked');
        return null;
      },
      setItem: () => {
        if (fail) throw new Error('storage blocked');
      },
    });
    fail = true;
    setAiEnabled(true); // setItem throws → in-memory fallback
    expect(isAiEnabled()).toBe(true); // getItem throws → in-memory fallback
    setAiEnabled(false);
    expect(isAiEnabled()).toBe(false);
  });

  it('reports a storage that refuses to record as disabled', () => {
    // A storage that silently drops writes must never report enabled.
    configureAiConsentStorage({ getItem: () => null, setItem: () => undefined });
    setAiEnabled(true);
    expect(isAiEnabled()).toBe(false);
  });
});
