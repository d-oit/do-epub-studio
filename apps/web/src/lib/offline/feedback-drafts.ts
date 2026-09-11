import { getDB, encryptEntry, decryptEntry } from './db';

export type FeedbackDraftKind = 'comment' | 'suggestion';
export type FeedbackDraftDelivery = 'draft' | 'pending' | 'sent' | 'failed' | 'blocked';

export interface FeedbackDraftAnchor {
  bookFileId?: string;
  chapterRef?: string;
  cfi?: string;
  selectedText: string;
  prefix?: string;
  suffix?: string;
}

export interface FeedbackDraft {
  id: string;
  bookId: string;
  ownerEmail: string;
  kind: FeedbackDraftKind;
  category: string;
  body: string;
  proposedText?: string;
  anchor: FeedbackDraftAnchor;
  mutationId: string;
  delivery: FeedbackDraftDelivery;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

export type FeedbackDraftListener = () => void;

const listeners = new Set<FeedbackDraftListener>();

/** Reactive hook for composer UI: notified on every draft mutation. */
export function subscribeFeedbackDrafts(listener: FeedbackDraftListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // A failing UI listener must never break persistence.
    }
  }
}

export async function saveFeedbackDraft(draft: FeedbackDraft): Promise<void> {
  const db = await getDB();
  const stored = await encryptEntry(draft, FEEDBACK_DRAFT_PLAINTEXT);
  await db.put('feedbackDrafts', stored);
  notify();
}

export async function loadFeedbackDrafts(
  bookId: string,
  ownerEmail: string,
): Promise<FeedbackDraft[]> {
  const db = await getDB();
  // Owner-scoped query: drafts are keyed by (ownerEmail, bookId) so one
  // account can never read another's drafts, even after a token switch.
  // Callers MUST additionally verify current book access before displaying.
  const entries = await db.getAllFromIndex('feedbackDrafts', 'ownerBook', [ownerEmail, bookId]);
  const decrypted = await Promise.all(
    (entries as Record<string, unknown>[]).map((e) =>
      decryptEntry<FeedbackDraft>(e, FEEDBACK_DRAFT_PLAINTEXT)),
  );
  const valid = decrypted.filter((e): e is FeedbackDraft => e !== null);
  valid.sort((a, b) => b.updatedAt - a.updatedAt);
  return valid;
}

export async function deleteFeedbackDraft(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('feedbackDrafts', id);
  notify();
}

export async function deleteFeedbackDraftByMutation(mutationId: string): Promise<void> {
  const db = await getDB();
  const all = await db.getAll('feedbackDrafts');
  const decrypted = await Promise.all(
    (all as Record<string, unknown>[]).map((e) =>
      decryptEntry<FeedbackDraft>(e, FEEDBACK_DRAFT_PLAINTEXT)),
  );
  const match = decrypted.find((e) => e !== null && e.mutationId === mutationId);
  if (match) {
    await db.delete('feedbackDrafts', match.id);
    notify();
  }
}

export async function markFeedbackDraft(
  id: string,
  delivery: FeedbackDraftDelivery,
  error?: string,
): Promise<void> {
  const db = await getDB();
  const stored = (await db.get('feedbackDrafts', id)) as Record<string, unknown> | undefined;
  if (!stored) return;
  const draft = await decryptEntry<FeedbackDraft>(stored, FEEDBACK_DRAFT_PLAINTEXT);
  if (!draft) return;
  await saveFeedbackDraft({
    ...draft,
    delivery,
    error,
    updatedAt: Date.now(),
  });
}

// Plaintext keys mirror the progress/annotation convention: routing fields
// stay queryable while human text stays session-encrypted.
const FEEDBACK_DRAFT_PLAINTEXT = ['id', 'bookId', 'ownerEmail', 'mutationId', 'delivery'] as const;
