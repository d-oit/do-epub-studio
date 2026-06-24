import { openDB, type IDBPDatabase } from 'idb';
import { encryptJSON, decryptJSON } from './crypto';
import { useAuthStore } from '@/stores/auth';

export interface ProgressEntry {
  id: string;
  bookId: string;
  cfi: string;
  percentage: number;
  lastRead: number;
  synced: boolean;
  mutationId: string;
}

export interface AnnotationEntry {
  id: string;
  bookId: string;
  type: 'highlight' | 'comment' | 'bookmark';
  cfi: string;
  endCfi?: string;
  text?: string;
  comment?: string;
  color?: string;
  chapter?: string;
  createdAt: number;
  synced: boolean;
  mutationId: string;
}

export interface SyncQueueItem {
  id: string;
  type: 'progress' | 'annotation' | 'insight';
  payload: unknown;
  mutationId: string;
  createdAt: number;
  attempts: number;
  lastAttempt?: number;
  error?: string;
}

export interface ReadingInsightEntry {
  bookId: string;
  date: string;
  activeMinutes: number;
  activePages: number;
  lastUpdated: number;
}

export interface PermissionCache {
  bookId: string;
  grantId: string;
  canComment: boolean;
  canDownloadOffline: boolean;
  cachedAt: number;
  expiresAt: number;
}

const DB_NAME = 'do-epub-studio';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase | null = null;
let cachedToken: string | null = null;

function token(): string | null {
  if (cachedToken) return cachedToken;
  const t = useAuthStore.getState().sessionToken;
  cachedToken = t;
  return t;
}

export function setTokenOverride(mockToken: string | null): void {
  cachedToken = mockToken;
}

async function encryptEntry<T extends object>(
  entry: T,
  plaintextKeys: readonly (keyof T)[],
): Promise<Record<string, unknown>> {
  const t = token();
  if (!t) return entry as Record<string, unknown>;

  const plaintext: Record<string, unknown> = {};
  const sensitive: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(entry)) {
    if ((plaintextKeys as readonly string[]).includes(key)) {
      plaintext[key] = value;
    } else {
      sensitive[key] = value;
    }
  }

  return {
    ...plaintext,
    encryptedPayload: await encryptJSON(sensitive, t),
  };
}

async function decryptEntry<T>(stored: Record<string, unknown>, plaintextKeys: readonly (keyof T)[]): Promise<T | null> {
  const t = token();
  const payload = stored.encryptedPayload;

  if (typeof payload === 'string' && t) {
    try {
      const decrypted = await decryptJSON<Record<string, unknown>>(payload, t);
      const result: Record<string, unknown> = {};
      for (const key of plaintextKeys as readonly string[]) {
        const val = key in stored ? stored[key] : undefined;
        if (val !== undefined) result[key] = val;
      }
      return { ...result, ...decrypted } as T;
    } catch {
      return null;
    }
  }

  const { encryptedPayload: _, ...rest } = stored;
  return rest as unknown as T;
}

const PROGRESS_PLAINTEXT = ['id', 'bookId', 'synced'] as const;
const ANNOTATION_PLAINTEXT = ['id', 'bookId', 'synced'] as const;
const SYNC_QUEUE_PLAINTEXT = ['id', 'createdAt'] as const;
const READING_INSIGHT_PLAINTEXT = ['bookId', 'date'] as const;
const PERMISSION_PLAINTEXT = ['bookId'] as const;

export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

export async function getDB(): Promise<IDBPDatabase> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('progress')) {
        const progressStore = db.createObjectStore('progress', { keyPath: 'id' });
        progressStore.createIndex('bookId', 'bookId');
        progressStore.createIndex('synced', 'synced');
      }

      if (!db.objectStoreNames.contains('annotations')) {
        const annotationStore = db.createObjectStore('annotations', { keyPath: 'id' });
        annotationStore.createIndex('bookId', 'bookId');
        annotationStore.createIndex('synced', 'synced');
      }

      if (!db.objectStoreNames.contains('syncQueue')) {
        const queueStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
        queueStore.createIndex('createdAt', 'createdAt');
      }

      if (!db.objectStoreNames.contains('permissions')) {
        db.createObjectStore('permissions', { keyPath: 'bookId' });
      }

      if (!db.objectStoreNames.contains('readingInsights')) {
        const insightsStore = db.createObjectStore('readingInsights', { keyPath: ['bookId', 'date'] });
        insightsStore.createIndex('bookId', 'bookId');
      }
    },
  });

  return dbInstance;
}

export async function saveProgress(entry: ProgressEntry): Promise<void> {
  const db = await getDB();
  const stored = await encryptEntry(entry, PROGRESS_PLAINTEXT);
  await db.put('progress', stored);
}

export async function getProgress(bookId: string): Promise<ProgressEntry | undefined> {
  const db = await getDB();
  const entries = await db.getAllFromIndex('progress', 'bookId', bookId);
  const decrypted = await Promise.all(
    (entries as Record<string, unknown>[]).map((e) => decryptEntry<ProgressEntry>(e, PROGRESS_PLAINTEXT)),
  );
  const valid = decrypted.filter((e): e is ProgressEntry => e !== null);
  return valid.sort((a, b) => b.lastRead - a.lastRead)[0];
}

export async function getUnsyncedProgress(): Promise<ProgressEntry[]> {
  const db = await getDB();
  const all = await db.getAll('progress');
  const decrypted = await Promise.all(
    (all as Record<string, unknown>[]).map((e) => decryptEntry<ProgressEntry>(e, PROGRESS_PLAINTEXT)),
  );
  return decrypted.filter((entry): entry is ProgressEntry => entry !== null && entry.synced === false);
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
    (all as Record<string, unknown>[]).map((e) => decryptEntry<AnnotationEntry>(e, ANNOTATION_PLAINTEXT)),
  );
  return decrypted.filter((e): e is AnnotationEntry => e !== null);
}

export async function getUnsyncedAnnotations(): Promise<AnnotationEntry[]> {
  const db = await getDB();
  const all = await db.getAll('annotations');
  const decrypted = await Promise.all(
    (all as Record<string, unknown>[]).map((e) => decryptEntry<AnnotationEntry>(e, ANNOTATION_PLAINTEXT)),
  );
  return decrypted.filter((entry): entry is AnnotationEntry => entry !== null && entry.synced === false);
}

export async function addToSyncQueue(item: SyncQueueItem): Promise<void> {
  const db = await getDB();
  const stored = await encryptEntry(item, SYNC_QUEUE_PLAINTEXT);
  await db.put('syncQueue', stored);
}

export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  const db = await getDB();
  const all = await db.getAll('syncQueue');
  const decrypted = await Promise.all(
    (all as Record<string, unknown>[]).map((e) => decryptEntry<SyncQueueItem>(e, SYNC_QUEUE_PLAINTEXT)),
  );
  return decrypted.filter((e): e is SyncQueueItem => e !== null);
}

export async function removeSyncQueueItem(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('syncQueue', id);
}

export async function updateSyncQueueItem(item: SyncQueueItem): Promise<void> {
  const db = await getDB();
  const stored = await encryptEntry(item, SYNC_QUEUE_PLAINTEXT);
  await db.put('syncQueue', stored);
}

export async function cachePermission(permission: PermissionCache): Promise<void> {
  const db = await getDB();
  const stored = await encryptEntry(permission, PERMISSION_PLAINTEXT);
  await db.put('permissions', stored);
}

export async function getCachedPermission(bookId: string): Promise<PermissionCache | undefined> {
  const db = await getDB();
  const stored = (await db.get('permissions', bookId)) as Record<string, unknown> | undefined;
  if (!stored) return undefined;
  const entry = await decryptEntry<PermissionCache>(stored, PERMISSION_PLAINTEXT);
  return entry ?? undefined;
}

export async function clearPermissionCache(bookId: string): Promise<void> {
  const db = await getDB();
  await db.delete('permissions', bookId);
}

export async function clearAllPermissionCache(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('permissions', 'readwrite');
  await tx.store.clear();
  await tx.done;
}

export async function clearAllEncryptedData(): Promise<void> {
  const db = await getDB();
  const stores = ['progress', 'annotations', 'syncQueue', 'permissions', 'readingInsights'];
  const tx = db.transaction(stores, 'readwrite');
  await Promise.all(stores.map((name) => tx.objectStore(name).clear()));
  await tx.done;
}

export async function saveReadingInsight(entry: ReadingInsightEntry): Promise<void> {
  const db = await getDB();
  const stored = await encryptEntry(entry, READING_INSIGHT_PLAINTEXT);
  await db.put('readingInsights', stored);
}

export async function getReadingInsight(bookId: string, date: string): Promise<ReadingInsightEntry | undefined> {
  const db = await getDB();
  const stored = (await db.get('readingInsights', [bookId, date])) as Record<string, unknown> | undefined;
  if (!stored) return undefined;
  const entry = await decryptEntry<ReadingInsightEntry>(stored, READING_INSIGHT_PLAINTEXT);
  return entry ?? undefined;
}

export async function getReadingInsightsForBook(bookId: string): Promise<ReadingInsightEntry[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('readingInsights', 'bookId', bookId);
  const decrypted = await Promise.all(
    (all as Record<string, unknown>[]).map((e) => decryptEntry<ReadingInsightEntry>(e, READING_INSIGHT_PLAINTEXT)),
  );
  return decrypted.filter((e): e is ReadingInsightEntry => e !== null);
}

export async function getAllReadingInsights(): Promise<ReadingInsightEntry[]> {
  const db = await getDB();
  const all = await db.getAll('readingInsights');
  const decrypted = await Promise.all(
    (all as Record<string, unknown>[]).map((e) => decryptEntry<ReadingInsightEntry>(e, READING_INSIGHT_PLAINTEXT)),
  );
  return decrypted.filter((e): e is ReadingInsightEntry => e !== null);
}
