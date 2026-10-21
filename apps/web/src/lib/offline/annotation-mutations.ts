import {
  getDB,
  encryptEntry,
  decryptEntry,
  captureSessionToken,
  assertSessionToken,
  ANNOTATION_PLAINTEXT,
  SYNC_QUEUE_PLAINTEXT,
  type AnnotationEntry,
  type SyncQueueItem,
} from './db';

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

export async function saveAnnotation(entry: AnnotationEntry): Promise<void> {
  const sessionToken = captureSessionToken();
  const db = await getDB();
  assertSessionToken(sessionToken);
  const stored = await encryptEntry(entry, ANNOTATION_PLAINTEXT);
  assertSessionToken(sessionToken);
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

/**
 * A mutation is owned by the session that created it: the caller passes the
 * token captured when the mutation started, and the write is refused once
 * that session is no longer current (S1/GOAP-1002).
 */
export async function persistAnnotationCreation(
  entry: AnnotationEntry,
  sessionToken: string,
): Promise<void> {
  assertSessionToken(sessionToken);

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

  assertSessionToken(sessionToken);

  const db = await getDB();
  assertSessionToken(sessionToken);
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
  assertSessionToken(sessionToken);

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

  assertSessionToken(sessionToken);

  const db = await getDB();
  assertSessionToken(sessionToken);
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
  assertSessionToken(sessionToken);

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

  assertSessionToken(sessionToken);

  const db = await getDB();
  assertSessionToken(sessionToken);
  const tx = db.transaction(['annotations', 'syncQueue'], 'readwrite');
  await Promise.all([
    tx.objectStore('annotations').put(encryptedEntry),
    tx.objectStore('syncQueue').delete(item.id),
  ]);
  await tx.done;

  notifyAnnotationChange(failedEntry.bookId);
}
