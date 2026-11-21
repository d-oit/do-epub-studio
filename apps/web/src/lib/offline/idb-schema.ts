import { openDB, type IDBPDatabase } from 'idb';

/**
 * Single source of truth for the on-device IndexedDB schema.
 *
 * All offline stores live in one database; the upgrade closure below is the
 * only place store shapes are declared. `db.ts` and the manifest store both
 * open through `openOfflineDb`, so the version bump (and the new
 * `downloadManifests` store introduced by issue #1485) is applied exactly once
 * no matter which module opens the database first. Opening with a version
 * higher than the on-disk version runs the upgrade; opening at the current
 * version after an upgrade is a plain open.
 */
export const OFFLINE_DB_NAME = 'do-epub-studio';
export const OFFLINE_DB_VERSION = 6;

/** Store names (kept in sync with db.ts's clear list). */
export const USER_DATA_STORES = [
  'progress',
  'annotations',
  'syncQueue',
  'permissions',
  'readingInsights',
  'conflicts',
  'bookFiles',
  'feedbackDrafts',
] as const;

export const DOWNLOAD_MANIFEST_STORE = 'downloadManifests';

/**
 * Creates/upgrades every offline store. Idempotent per store (`contains`
 * guards), so older upgrades that were partially applied never double-create.
 */
export function upgradeOfflineDb(db: IDBPDatabase<unknown>, oldVersion: number): void {
  if (oldVersion < 1) {
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
      const insightsStore = db.createObjectStore('readingInsights', {
        keyPath: ['bookId', 'date'],
      });
      insightsStore.createIndex('bookId', 'bookId');
    }
  }

  // v1→v2: AnnotationEntry gains optional status/visibility fields (no
  // structural change). v2→v3: conflicts. v3→v4: feedbackDrafts. v4→v5:
  // bookFiles. All historical migrations are folded into the block below so a
  // fresh install creates every store at once.
  if (oldVersion < 3 && !db.objectStoreNames.contains('conflicts')) {
    db.createObjectStore('conflicts', { keyPath: 'id' });
  }
  if (oldVersion < 4 && !db.objectStoreNames.contains('feedbackDrafts')) {
    const draftsStore = db.createObjectStore('feedbackDrafts', { keyPath: 'id' });
    draftsStore.createIndex('ownerBook', ['ownerEmail', 'bookId']);
  }
  if (oldVersion < 5 && !db.objectStoreNames.contains('bookFiles')) {
    db.createObjectStore('bookFiles', { keyPath: 'bookId' });
  }

  // v5→v6 (issue #1485): per-book offline download manifests.
  if (oldVersion < 6 && !db.objectStoreNames.contains(DOWNLOAD_MANIFEST_STORE)) {
    const manifestStore = db.createObjectStore(DOWNLOAD_MANIFEST_STORE, {
      keyPath: 'bookId',
    });
    manifestStore.createIndex('state', 'state');
    manifestStore.createIndex('lastAccess', 'lastAccess');
  }
}

export function openOfflineDb(): Promise<IDBPDatabase> {
  return openDB(OFFLINE_DB_NAME, OFFLINE_DB_VERSION, { upgrade: upgradeOfflineDb });
}
