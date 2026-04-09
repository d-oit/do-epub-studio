import { openDB, type IDBPDatabase } from 'idb';

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
  type: 'highlight' | 'comment';
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
  type: 'progress' | 'annotation';
  payload: unknown;
  mutationId: string;
  createdAt: number;
  attempts: number;
  lastAttempt?: number;
  error?: string;
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
    },
  });

  return dbInstance;
}

export async function saveProgress(entry: ProgressEntry): Promise<void> {
  const db = await getDB();
  await db.put('progress', entry);
}

export async function getProgress(bookId: string): Promise<ProgressEntry | undefined> {
  const db = await getDB();
  const entries = await db.getAllFromIndex('progress', 'bookId', bookId);
  return entries.sort((a, b) => b.lastRead - a.lastRead)[0];
}

export async function getUnsyncedProgress(): Promise<ProgressEntry[]> {
  const db = await getDB();
  const all = await db.getAll('progress');
  return all.filter((entry) => entry.synced === false);
}

export async function saveAnnotation(entry: AnnotationEntry): Promise<void> {
  const db = await getDB();
  await db.put('annotations', entry);
}

export async function getAnnotations(bookId: string): Promise<AnnotationEntry[]> {
  const db = await getDB();
  return db.getAllFromIndex('annotations', 'bookId', bookId);
}

export async function getUnsyncedAnnotations(): Promise<AnnotationEntry[]> {
  const db = await getDB();
  const all = await db.getAll('annotations');
  return all.filter((entry) => entry.synced === false);
}

export async function addToSyncQueue(item: SyncQueueItem): Promise<void> {
  const db = await getDB();
  await db.put('syncQueue', item);
}

export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  const db = await getDB();
  return db.getAll('syncQueue');
}

export async function removeSyncQueueItem(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('syncQueue', id);
}

export async function updateSyncQueueItem(item: SyncQueueItem): Promise<void> {
  const db = await getDB();
  await db.put('syncQueue', item);
}

export async function cachePermission(permission: PermissionCache): Promise<void> {
  const db = await getDB();
  await db.put('permissions', permission);
}

export async function getCachedPermission(bookId: string): Promise<PermissionCache | undefined> {
  const db = await getDB();
  return db.get('permissions', bookId);
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
