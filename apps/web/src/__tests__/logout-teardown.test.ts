import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '../stores/auth';
import { useReaderStore } from '../stores/reader';
import { getDB, clearAllEncryptedData, setTokenOverride } from '../lib/offline/db';

describe('S1: Logout and auth-loss device-data teardown', () => {
  beforeEach(async () => {
    setTokenOverride('test-token');
    useAuthStore.setState({
      sessionToken: 'test-token',
      isAuthenticated: true,
      bookId: 'book-1',
    });
    useReaderStore.setState({
      bookmarks: [{ id: 'b1', locator: { cfi: 'cfi' }, label: 'Ch 1', createdAt: '' }],
      highlights: [
        {
          id: 'h1',
          chapterRef: 'ch1',
          cfiRange: 'cfi',
          selectedText: 'text',
          note: 'note',
          color: 'yellow',
          createdAt: '',
          updatedAt: '',
        },
      ],
      comments: [
        {
          id: 'c1',
          displayName: 'User',
          isOwn: true,
          chapterRef: 'ch1',
          cfiRange: 'cfi',
          selectedText: 'text',
          body: 'comment',
          status: 'open',
          visibility: 'shared',
          parentCommentId: null,
          createdAt: '',
          updatedAt: '',
          resolvedAt: null,
        },
      ],
      progress: { locator: { cfi: 'cfi' }, progressPercent: 40, updatedAt: '' },
    });

    const db = await getDB();
    const tx = db.transaction(
      [
        'progress',
        'annotations',
        'syncQueue',
        'permissions',
        'readingInsights',
        'conflicts',
        'feedbackDrafts',
      ],
      'readwrite',
    );
    await tx.objectStore('progress').put({ id: 'p1', encryptedPayload: 'enc' });
    await tx.objectStore('annotations').put({ id: 'a1', encryptedPayload: 'enc' });
    await tx.objectStore('feedbackDrafts').put({ id: 'f1', encryptedPayload: 'enc' });
    await tx.done;
  });

  it('logout() resets reader store in memory', () => {
    expect(useReaderStore.getState().bookmarks).toHaveLength(1);
    expect(useReaderStore.getState().highlights).toHaveLength(1);
    expect(useReaderStore.getState().comments).toHaveLength(1);
    expect(useReaderStore.getState().progress.progressPercent).toBe(40);

    useAuthStore.getState().logout();

    expect(useAuthStore.getState().sessionToken).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useReaderStore.getState().bookmarks).toHaveLength(0);
    expect(useReaderStore.getState().highlights).toHaveLength(0);
    expect(useReaderStore.getState().comments).toHaveLength(0);
    expect(useReaderStore.getState().progress.progressPercent).toBe(0);
  });

  it('clearAllEncryptedData() purges all sensitive stores including feedbackDrafts', async () => {
    const dbBefore = await getDB();
    expect(await dbBefore.get('progress', 'p1')).toBeDefined();
    expect(await dbBefore.get('annotations', 'a1')).toBeDefined();
    expect(await dbBefore.get('feedbackDrafts', 'f1')).toBeDefined();

    await clearAllEncryptedData();

    const dbAfter = await getDB();
    expect(await dbAfter.get('progress', 'p1')).toBeUndefined();
    expect(await dbAfter.get('annotations', 'a1')).toBeUndefined();
    expect(await dbAfter.get('feedbackDrafts', 'f1')).toBeUndefined();
  });
});
