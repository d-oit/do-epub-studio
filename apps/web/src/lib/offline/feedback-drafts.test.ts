import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveFeedbackDraft,
  loadFeedbackDrafts,
  deleteFeedbackDraft,
  deleteFeedbackDraftByMutation,
  markFeedbackDraft,
  subscribeFeedbackDrafts,
  type FeedbackDraft,
} from './feedback-drafts';
import { closeDb } from './db';

function makeDraft(overrides: Partial<FeedbackDraft> = {}): FeedbackDraft {
  return {
    id: 'draft-1',
    bookId: 'book-1',
    ownerEmail: 'reader@example.com',
    kind: 'suggestion',
    category: 'grammar',
    body: 'Consider a comma here.',
    proposedText: 'Consider, a comma here.',
    anchor: { selectedText: 'Consider a comma here.', chapterRef: 'ch1' },
    mutationId: '11111111-1111-4111-8111-111111111111',
    delivery: 'draft',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe('feedback drafts (REL-02 durable layer)', () => {
  beforeEach(async () => {
    closeDb();
    // Fresh database per test: delete all known databases.
    const dbs = (await indexedDB.databases?.()) ?? [];
    await Promise.all(dbs.map((db) => {
      if (!db.name) return Promise.resolve();
      const dbName: string = db.name;
      return new Promise<void>((resolve, reject) => {
        const req = indexedDB.deleteDatabase(dbName);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(new Error(`Failed to delete database ${db.name}`));
      });
    }));
  });

  it('round-trips a draft with human text and provenance intact', async () => {
    await saveFeedbackDraft(makeDraft());

    const drafts = await loadFeedbackDrafts('book-1', 'reader@example.com');
    expect(drafts).toHaveLength(1);
    expect(drafts[0].body).toBe('Consider a comma here.');
    expect(drafts[0].proposedText).toBe('Consider, a comma here.');
    expect(drafts[0].anchor.selectedText).toBe('Consider a comma here.');
    expect(drafts[0].mutationId).toBe('11111111-1111-4111-8111-111111111111');
  });

  it('isolates drafts by owner: another account loads nothing', async () => {
    await saveFeedbackDraft(makeDraft());

    const other = await loadFeedbackDrafts('book-1', 'other@example.com');
    expect(other).toEqual([]);
    const otherBook = await loadFeedbackDrafts('book-2', 'reader@example.com');
    expect(otherBook).toEqual([]);
  });

  it('marks blocked delivery without losing human text', async () => {
    await saveFeedbackDraft(makeDraft());
    await markFeedbackDraft('draft-1', 'blocked', 'Contribution rights revoked');

    const drafts = await loadFeedbackDrafts('book-1', 'reader@example.com');
    expect(drafts).toHaveLength(1);
    expect(drafts[0].delivery).toBe('blocked');
    expect(drafts[0].error).toBe('Contribution rights revoked');
    expect(drafts[0].body).toBe('Consider a comma here.');
  });

  it('deletes a draft by mutation id on successful replay', async () => {
    await saveFeedbackDraft(makeDraft());
    await deleteFeedbackDraftByMutation('11111111-1111-4111-8111-111111111111');

    expect(await loadFeedbackDrafts('book-1', 'reader@example.com')).toEqual([]);
  });

  it('deletes a draft by id', async () => {
    await saveFeedbackDraft(makeDraft());
    await deleteFeedbackDraft('draft-1');

    expect(await loadFeedbackDrafts('book-1', 'reader@example.com')).toEqual([]);
  });

  it('notifies subscribers on every mutation', async () => {
    let calls = 0;
    const unsubscribe = subscribeFeedbackDrafts(() => {
      calls += 1;
    });

    await saveFeedbackDraft(makeDraft());
    await markFeedbackDraft('draft-1', 'pending');
    await deleteFeedbackDraft('draft-1');
    unsubscribe();
    await saveFeedbackDraft(makeDraft());

    expect(calls).toBe(3);
  });
});
