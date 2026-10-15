import {
  getDB,
  encryptEntry,
  decryptEntry,
  ANNOTATION_PLAINTEXT,
  SYNC_QUEUE_PLAINTEXT,
  type AnnotationEntry,
  type SyncQueueItem,
} from './db';
import { useAuthStore } from '@/stores/auth';

type AnnotationChangeListener = (bookId: string) => void;
const listeners = new Set<AnnotationChangeListener>();

export function subscribeAnnotationChanges(listener: AnnotationChangeListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyAnnotationChange(bookId: string): void {
  for (const listener of listeners) {
    try {
      listener(bookId);
    } catch {
      // Ignore listener error
    }
  }
}

function assertCurrentSession(sessionToken: string): void {
  if (!sessionToken || sessionToken !== useAuthStore.getState().sessionToken) {
    const error = new Error('Session expired');
    (error as Error & { status?: number }).status = 401;
    throw error;
  }
}

export async function saveAnnotation(entry: AnnotationEntry): Promise<void> {
  const db = await getDB();
  const stored = await encryptEntry(entry, ANNOTATION_PLAINTEXT);
  await db.put('annotations', stored);
}

export async function getAnnotations(bookId: string): Promise<AnnotationEntry[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('annotations', 'bookId', bookId);
  const decrypted = await Promise.all(
    (all as Record<string, unknown>[]).map((e) =>
      decryptEntry<AnnotationEntry>(e, ANNOTATION_PLAINTEXT),
    ),
  );
  return decrypted.filter((e): e is AnnotationEntry => e !== null);
}

export async function getUnsyncedAnnotations(): Promise<AnnotationEntry[]> {
  const db = await getDB();
  const all = await db.getAll('annotations');
  const decrypted = await Promise.all(
    (all as Record<string, unknown>[]).map((e) =>
      decryptEntry<AnnotationEntry>(e, ANNOTATION_PLAINTEXT),
    ),
  );
  return decrypted.filter(
    (entry): entry is AnnotationEntry => entry !== null && entry.synced === false,
  );
}

export async function persistAnnotationCreation(
  entry: AnnotationEntry,
  sessionToken: string,
): Promise<void> {
  assertCurrentSession(sessionToken);

  const queueItem: SyncQueueItem = {
    id: crypto.randomUUID(),
    type: 'annotation',
    payload: {
      bookId: entry.bookId,
      annotation: entry,
      action: 'create',
    },
    mutationId: entry.mutationId,
    createdAt: Date.now(),
    attempts: 0,
  };

  const encryptedAnnotation = await encryptEntry(entry, ANNOTATION_PLAINTEXT);
  const encryptedQueue = await encryptEntry(queueItem, SYNC_QUEUE_PLAINTEXT);

  assertCurrentSession(sessionToken);

  const db = await getDB();
  const tx = db.transaction(['annotations', 'syncQueue'], 'readwrite');
  await Promise.all([
    tx.objectStore('annotations').put(encryptedAnnotation),
    tx.objectStore('syncQueue').put(encryptedQueue),
  ]);
  await tx.done;

  notifyAnnotationChange(entry.bookId);
}

export async function settleAnnotationCreation(
  item: SyncQueueItem,
  entry: AnnotationEntry,
  sessionToken: string,
): Promise<void> {
  assertCurrentSession(sessionToken);

  const encryptedEntry = await encryptEntry(entry, ANNOTATION_PLAINTEXT);

  let localIdToDelete: string | null = null;
  const payloadAnnotation: unknown =
    item.payload && typeof item.payload === 'object' && 'annotation' in item.payload
      ? item.payload.annotation
      : null;
  if (payloadAnnotation && typeof payloadAnnotation === 'object' && 'id' in payloadAnnotation) {
    const candidateId: unknown = payloadAnnotation.id;
    if (typeof candidateId === 'string' && candidateId.length > 0 && candidateId !== entry.id) {
      localIdToDelete = candidateId;
    }
  }

  assertCurrentSession(sessionToken);

  const db = await getDB();
  const tx = db.transaction(['annotations', 'syncQueue'], 'readwrite');
  const annotationsStore = tx.objectStore('annotations');
  const queueStore = tx.objectStore('syncQueue');

  const ops: Promise<unknown>[] = [
    annotationsStore.put(encryptedEntry),
    queueStore.delete(item.id),
  ];
  if (localIdToDelete) {
    ops.push(annotationsStore.delete(localIdToDelete));
  }
  await Promise.all(ops);
  await tx.done;

  notifyAnnotationChange(entry.bookId);
}

export async function failAnnotationCreation(
  item: SyncQueueItem,
  detail: string,
  sessionToken: string,
): Promise<void> {
  assertCurrentSession(sessionToken);

  let baseAnnotation: Partial<AnnotationEntry> = {};
  if (item.payload && typeof item.payload === 'object' && 'annotation' in item.payload) {
    baseAnnotation = (item.payload as { annotation: AnnotationEntry }).annotation ?? {};
  }

  const recordId =
    baseAnnotation.id && baseAnnotation.id.length > 0
      ? baseAnnotation.id
      : `local-annotation-${item.mutationId}`;

  const failedEntry: AnnotationEntry = {
    ...baseAnnotation,
    id: recordId,
    bookId:
      baseAnnotation.bookId ??
      (item.payload && typeof item.payload === 'object' && 'bookId' in item.payload
        ? (item.payload as { bookId: string }).bookId
        : ''),
    type: baseAnnotation.type ?? 'highlight',
    cfi: baseAnnotation.cfi ?? '',
    createdAt: baseAnnotation.createdAt ?? item.createdAt,
    mutationId: item.mutationId,
    synced: false,
    syncError: detail,
  };

  const encryptedEntry = await encryptEntry(failedEntry, ANNOTATION_PLAINTEXT);

  assertCurrentSession(sessionToken);

  const db = await getDB();
  const tx = db.transaction(['annotations', 'syncQueue'], 'readwrite');
  await Promise.all([
    tx.objectStore('annotations').put(encryptedEntry),
    tx.objectStore('syncQueue').delete(item.id),
  ]);
  await tx.done;

  notifyAnnotationChange(failedEntry.bookId);
}
