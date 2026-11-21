import type { IDBPDatabase } from 'idb';
import { DOWNLOAD_MANIFEST_STORE, openOfflineDb } from './idb-schema';
import { bookCacheName, stagingCacheName } from './ownership';
import { parseDownloadManifest } from './manifest-types';
import { isRecord } from './guards';
import type {
  DownloadManifest,
  DownloadManifestState,
  DownloadResourceSpec,
} from './manifest-types';

/**
 * IndexedDB access for download manifests (issue #1485).
 *
 * This module deliberately does NOT import `db.ts`: it must be safe to load
 * inside the service worker, where the auth store (zustand) must not be
 * pulled into the SW bundle. It owns its own connection to the same database;
 * schema/version live in `idb-schema.ts`, so both connections agree.
 */

let manifestDb: IDBPDatabase | null = null;

export async function getManifestDb(): Promise<IDBPDatabase> {
  if (!manifestDb) {
    manifestDb = await openOfflineDb();
  }
  return manifestDb;
}

export function closeManifestDb(): void {
  if (manifestDb) {
    manifestDb.close();
    manifestDb = null;
  }
}

export async function getManifest(bookId: string): Promise<DownloadManifest | undefined> {
  const db = await getManifestDb();
  const raw: unknown = await db.get(DOWNLOAD_MANIFEST_STORE, bookId);
  return parseDownloadManifest(raw) ?? undefined;
}

export async function listManifests(): Promise<DownloadManifest[]> {
  const db = await getManifestDb();
  const all = (await db.getAll(DOWNLOAD_MANIFEST_STORE)) as unknown[];
  return all.flatMap((raw) => {
    const parsed = parseDownloadManifest(raw);
    return parsed ? [parsed] : [];
  });
}

export async function listManifestsByState(
  state: DownloadManifestState,
): Promise<DownloadManifest[]> {
  const db = await getManifestDb();
  const rows = (await db.getAllFromIndex(DOWNLOAD_MANIFEST_STORE, 'state', state)) as unknown[];
  return rows.flatMap((raw) => {
    const parsed = parseDownloadManifest(raw);
    return parsed ? [parsed] : [];
  });
}

/**
 * Sweep unparseable rows (corrupt/foreign shapes). Returns removed bookIds so
 * recovery can quarantine the associated caches.
 */
export async function sweepInvalidManifests(): Promise<string[]> {
  const db = await getManifestDb();
  const all = (await db.getAll(DOWNLOAD_MANIFEST_STORE)) as unknown[];
  const removed: string[] = [];
  const tx = db.transaction(DOWNLOAD_MANIFEST_STORE, 'readwrite');
  for (const raw of all) {
    if (parseDownloadManifest(raw) !== null || !isRecord(raw)) continue;
    const bookId = raw.bookId;
    if (typeof bookId === 'string') {
      void tx.store.delete(bookId);
      removed.push(bookId);
    }
  }
  await tx.done;
  return removed;
}

/**
 * Atomically start a download attempt: (re)assign a fresh attempt id and
 * staging namespace, regardless of the previous state. Returns the identifiers
 * the engine must use for this attempt. Any older in-flight attempt is
 * superseded — its commit/fail will be rejected by the CAS in
 * `commitDownload`/`failDownload`.
 */
export async function beginDownload(
  bookId: string,
  packageVersion: string,
  expectedBytes: number,
): Promise<{ attemptId: string; cacheName: string; stagingCacheName: string }> {
  const db = await getManifestDb();
  const attemptId = crypto.randomUUID();
  const cacheName = bookCacheName(bookId);
  const staging = stagingCacheName(bookId, attemptId);
  const now = Date.now();

  const manifest: DownloadManifest = {
    bookId,
    packageVersion,
    attemptId,
    state: 'staging',
    resources: [],
    totalBytes: 0,
    expectedBytes,
    cacheName,
    stagingCacheName: staging,
    lastAccess: now,
    createdAt: now,
    updatedAt: now,
  };

  const tx = db.transaction(DOWNLOAD_MANIFEST_STORE, 'readwrite');
  void tx.store.put(manifest);
  await tx.done;
  return { attemptId, cacheName, stagingCacheName: staging };
}

/**
 * Atomically flip a staging attempt to `complete` — the single write that
 * makes a book offline-ready. Returns false when the attempt no longer owns
 * the manifest (superseded by a newer attempt, or removed), so stale workers
 * can never clobber a newer download.
 */
export async function commitDownload(
  bookId: string,
  attemptId: string,
  resources: DownloadResourceSpec[],
  totalBytes: number,
): Promise<boolean> {
  const db = await getManifestDb();
  const tx = db.transaction(DOWNLOAD_MANIFEST_STORE, 'readwrite');
  const existing = parseDownloadManifest(await tx.store.get(bookId));
  if (!existing || existing.attemptId !== attemptId || existing.state !== 'staging') {
    await tx.done;
    return false;
  }
  const now = Date.now();
  const updated: DownloadManifest = {
    ...existing,
    state: 'complete',
    resources,
    totalBytes,
    lastAccess: now,
    updatedAt: now,
  };
  void tx.store.put(updated);
  await tx.done;
  return true;
}

/**
 * Atomically record a failed attempt (CAS on attemptId). Returns false when
 * superseded.
 */
export async function failDownload(
  bookId: string,
  attemptId: string,
  code: string,
  message: string,
): Promise<boolean> {
  const db = await getManifestDb();
  const tx = db.transaction(DOWNLOAD_MANIFEST_STORE, 'readwrite');
  const existing = parseDownloadManifest(await tx.store.get(bookId));
  if (!existing || existing.attemptId !== attemptId || existing.state === 'complete') {
    await tx.done;
    return false;
  }
  const now = Date.now();
  const updated: DownloadManifest = {
    ...existing,
    state: 'failed',
    failure: { code, message, at: now },
    updatedAt: now,
  };
  void tx.store.put(updated);
  await tx.done;
  return true;
}

/** Update lastAccess (LRU heat) for a book, without changing state. */
export async function touchManifest(bookId: string): Promise<void> {
  const db = await getManifestDb();
  const tx = db.transaction(DOWNLOAD_MANIFEST_STORE, 'readwrite');
  const existing = parseDownloadManifest(await tx.store.get(bookId));
  if (!existing) {
    await tx.done;
    return;
  }
  void tx.store.put({ ...existing, lastAccess: Date.now() });
  await tx.done;
}

/** Null the staging cache reference after the staging cache was deleted. */
export async function clearStagingReference(bookId: string): Promise<void> {
  const db = await getManifestDb();
  const tx = db.transaction(DOWNLOAD_MANIFEST_STORE, 'readwrite');
  const existing = parseDownloadManifest(await tx.store.get(bookId));
  if (!existing || !existing.stagingCacheName) {
    await tx.done;
    return;
  }
  void tx.store.put({ ...existing, stagingCacheName: null, updatedAt: Date.now() });
  await tx.done;
}

export async function removeManifest(bookId: string): Promise<void> {
  const db = await getManifestDb();
  await db.delete(DOWNLOAD_MANIFEST_STORE, bookId);
}

/** Test/teardown helper: wipe every manifest. */
export async function clearAllManifests(): Promise<void> {
  const db = await getManifestDb();
  const tx = db.transaction(DOWNLOAD_MANIFEST_STORE, 'readwrite');
  await tx.store.clear();
  await tx.done;
}
