import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getDB,
  saveBookFile,
  getBookFile,
  clearAllEncryptedData,
  setTokenOverride,
  type BookFileEntry,
} from '../lib/offline/db';

const TEST_TOKEN = 'test-session-token-for-offline-db';

describe('Offline Database — cached book file URL (A5, GOAP-300)', () => {
  beforeEach(async () => {
    setTokenOverride(null);
    const db = await getDB();
    const tx = db.transaction(['bookFiles'], 'readwrite');
    await tx.objectStore('bookFiles').clear();
    await tx.done;
  });

  afterEach(() => {
    setTokenOverride(null);
  });

  it('round-trips a book file entry through encryption at rest', async () => {
    setTokenOverride(TEST_TOKEN);
    const entry: BookFileEntry = {
      bookId: 'book-1',
      url: 'https://example.test/api/files/1?signature=SYNTHETIC-SIGNED-CAPABILITY',
      fileId: 'file-1',
      cachedAt: 1_700_000_000_000,
    };

    await saveBookFile(entry);

    const stored = (await (await getDB()).get('bookFiles', 'book-1')) as Record<string, unknown>;
    expect(stored.encryptedPayload).toBeTruthy();
    expect(JSON.stringify(stored)).not.toContain('SYNTHETIC-SIGNED-CAPABILITY');

    const loaded = await getBookFile('book-1');
    expect(loaded?.url).toBe(entry.url);
    expect(loaded?.fileId).toBe('file-1');
    expect(loaded?.cachedAt).toBe(entry.cachedAt);
  });

  it('returns undefined for a book with no cached file', async () => {
    setTokenOverride(TEST_TOKEN);
    expect(await getBookFile('missing-book')).toBeUndefined();
  });

  it('does not decrypt with a different session key', async () => {
    setTokenOverride(TEST_TOKEN);
    await saveBookFile({
      bookId: 'book-2',
      url: 'https://example.test/api/files/2?signature=x',
      fileId: null,
      cachedAt: 1,
    });
    setTokenOverride('other-session-token');
    expect(await getBookFile('book-2')).toBeUndefined();
  });

  it('is purged by clearAllEncryptedData (logout path)', async () => {
    setTokenOverride(TEST_TOKEN);
    await saveBookFile({
      bookId: 'book-3',
      url: 'https://example.test/api/files/3?signature=y',
      fileId: null,
      cachedAt: 1,
    });
    await clearAllEncryptedData();
    expect(await getBookFile('book-3')).toBeUndefined();
  });
});
