/**
 * Persistent-storage policy (issue #1485).
 *
 * Browsers may evict site storage under pressure. `navigator.storage.persist`
 * marks the origin as exempt from automatic eviction where supported; the
 * request must be made from a user gesture to be granted. We feature-detect,
 * request it (from the settings panel), and surface denial/absence so the UI
 * can explain why offline books might be cleared.
 */

export interface StorageEstimate {
  usage: number;
  quota: number;
}

export interface PersistentStorageStatus {
  /** persist()/persisted() available at all. */
  supported: boolean;
  /** Currently persisted (granted). */
  persisted: boolean;
  /** persist() was called and returned false (denied). */
  denied: boolean;
}

interface StorageEstimateApi {
  estimate(): Promise<StorageEstimate>;
  persist(): Promise<boolean>;
  persisted(): Promise<boolean>;
}

function storageApi(): StorageEstimateApi | null {
  const storage = (navigator as { storage?: Partial<StorageEstimateApi> }).storage;
  if (!storage || typeof storage.estimate !== 'function') return null;
  return storage as StorageEstimateApi;
}

export async function getStorageEstimate(): Promise<StorageEstimate | null> {
  const api = storageApi();
  if (!api) return null;
  try {
    const estimate = await api.estimate();
    return { usage: estimate.usage ?? 0, quota: estimate.quota ?? 0 };
  } catch {
    return null;
  }
}

export async function getPersistentStorageStatus(): Promise<PersistentStorageStatus> {
  const api = storageApi();
  if (!api || typeof api.persisted !== 'function') {
    return { supported: false, persisted: false, denied: false };
  }
  try {
    const persisted = await api.persisted();
    return { supported: true, persisted, denied: false };
  } catch {
    return { supported: true, persisted: false, denied: false };
  }
}

export async function requestPersistentStorage(): Promise<PersistentStorageStatus> {
  const api = storageApi();
  if (!api || typeof api.persist !== 'function') {
    return { supported: false, persisted: false, denied: false };
  }
  try {
    const granted = await api.persist();
    return { supported: true, persisted: granted, denied: !granted };
  } catch {
    return { supported: true, persisted: false, denied: true };
  }
}
