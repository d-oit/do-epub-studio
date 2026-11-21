import { closeDb } from '../db';
import { closeManifestDb, getManifestDb } from '../manifest-store';

/**
 * Reset offline storage to a clean slate by clearing every object store in
 * place. Database deletion is avoided: fake-indexeddb (like real IndexedDB)
 * refuses `deleteDatabase` while connections are open, which made resets hang
 * once a test left an extra connection behind.
 */
export async function resetIndexedDb(): Promise<void> {
  closeDb();
  closeManifestDb();
  const db = await getManifestDb();
  const stores = Array.from(db.objectStoreNames);
  const tx = db.transaction(stores, 'readwrite');
  await Promise.all(stores.map((name) => tx.objectStore(name).clear()));
  await tx.done;
}
