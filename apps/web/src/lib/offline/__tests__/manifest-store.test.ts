import { describe, it, expect, beforeEach } from 'vitest';
import { openOfflineDb } from '../idb-schema';
import {
  beginDownload,
  clearAllManifests,
  commitDownload,
  failDownload,
  getManifest,
  listManifests,
  sweepInvalidManifests,
} from '../manifest-store';
import { resetIndexedDb } from './reset-idb';

describe('download manifest store (issue #1485)', () => {
  beforeEach(async () => {
    await resetIndexedDb();
  });

  it('beginDownload creates a staging manifest with a dedicated namespace', async () => {
    const { attemptId, cacheName, stagingCacheName } = await beginDownload(
      'book-1',
      'file-9',
      1000,
    );
    expect(attemptId).toBeTruthy();
    expect(cacheName).toBe('dl/book-1');
    expect(stagingCacheName).toBe(`dl-staging/book-1/${attemptId}`);

    const manifest = await getManifest('book-1');
    expect(manifest).toBeDefined();
    expect(manifest?.state).toBe('staging');
    expect(manifest?.packageVersion).toBe('file-9');
    expect(manifest?.expectedBytes).toBe(1000);
    expect(manifest?.resources).toEqual([]);
  });

  it('commitDownload flips a staging attempt to complete (atomic CAS)', async () => {
    const { attemptId } = await beginDownload('book-1', 'file-9', 100);
    const resource = { url: 'https://files/1', bytes: 100, sha256: 'a'.repeat(64) };
    const committed = await commitDownload('book-1', attemptId, [resource], 100);
    expect(committed).toBe(true);

    const manifest = await getManifest('book-1');
    expect(manifest?.state).toBe('complete');
    expect(manifest?.resources).toEqual([resource]);
    expect(manifest?.totalBytes).toBe(100);
  });

  it('treats a manifest row without a string attemptId as corrupt', async () => {
    await beginDownload('book-1', 'file-9', 100);
    const opened = await openOfflineDb();
    const row = await opened.get('downloadManifests', 'book-1');
    await opened.put('downloadManifests', { ...row, attemptId: 42 });
    opened.close();

    await expect(getManifest('book-1')).resolves.toBeUndefined();
  });

  it('commitDownload rejects stale attempts (superseded by a newer one)', async () => {
    const first = await beginDownload('book-1', 'file-9', 100);
    const second = await beginDownload('book-1', 'file-9', 100);
    expect(second.attemptId).not.toBe(first.attemptId);

    await expect(commitDownload('book-1', first.attemptId, [], 0)).resolves.toBe(false);
    const committed = await commitDownload(
      'book-1',
      second.attemptId,
      [{ url: 'u', bytes: 5, sha256: 'b'.repeat(64) }],
      5,
    );
    expect(committed).toBe(true);

    const manifest = await getManifest('book-1');
    expect(manifest?.state).toBe('complete');
    expect(manifest?.attemptId).toBe(second.attemptId);
  });

  it('commitDownload refuses to flip a non-staging manifest', async () => {
    const { attemptId } = await beginDownload('book-1', 'file-9', 10);
    await failDownload('book-1', attemptId, 'network', 'boom');
    await expect(commitDownload('book-1', attemptId, [], 0)).resolves.toBe(false);
  });

  it('failDownload records a typed failure and cannot overwrite complete state', async () => {
    const { attemptId } = await beginDownload('book-1', 'file-9', 10);
    const failed = await failDownload('book-1', attemptId, 'quota', 'out of space');
    expect(failed).toBe(true);
    const manifest = await getManifest('book-1');
    expect(manifest?.state).toBe('failed');
    expect(manifest?.failure?.code).toBe('quota');

    // A complete manifest is never failed.
    const second = await beginDownload('book-1', 'file-9', 10);
    await commitDownload(
      'book-1',
      second.attemptId,
      [{ url: 'u', bytes: 1, sha256: 'c'.repeat(64) }],
      1,
    );
    await expect(failDownload('book-1', second.attemptId, 'network', 'late')).resolves.toBe(false);
    expect((await getManifest('book-1'))?.state).toBe('complete');
  });

  it('sweepInvalidManifests removes unparseable rows and reports their bookIds', async () => {
    await beginDownload('book-1', 'file-9', 10);
    await beginDownload('book-2', 'file-8', 20);

    const opened = await openOfflineDb();
    await opened.put('downloadManifests', { bookId: 'corrupt-book', state: 'weird' });
    opened.close();

    const removed = await sweepInvalidManifests();
    expect(removed).toContain('corrupt-book');
    const manifests = await listManifests();
    expect(manifests.map((m) => m.bookId)).toEqual(['book-1', 'book-2']);
  });

  it('clearAllManifests empties the store', async () => {
    await beginDownload('book-1', 'file-9', 10);
    await clearAllManifests();
    expect(await listManifests()).toEqual([]);
  });
});
