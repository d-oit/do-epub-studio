import {
  cachePermission,
  getCachedPermission,
  clearPermissionCache,
  clearAllPermissionCache,
  type PermissionCache,
} from './db';
import { api } from '../api';

const PERMISSION_CACHE_TTL = 24 * 60 * 60 * 1000;

export interface CachedPermission {
  bookId: string;
  grantId: string;
  canComment: boolean;
  canDownloadOffline: boolean;
  isValid: boolean;
}

export async function validatePermission(bookId: string): Promise<CachedPermission> {
  const cached = await getCachedPermission(bookId);
  const now = Date.now();

  if (cached && cached.expiresAt > now) {
    return {
      bookId: cached.bookId,
      grantId: cached.grantId,
      canComment: cached.canComment,
      canDownloadOffline: cached.canDownloadOffline,
      isValid: true,
    };
  }

  try {
    const response = await api.get(`/api/access/validate?bookId=${bookId}`);
    if (response.ok) {
      const data = (await response.json()) as {
        grantId: string;
        canComment: boolean;
        canDownloadOffline: boolean;
      };
      const permission: PermissionCache = {
        bookId,
        grantId: data.grantId,
        canComment: data.canComment,
        canDownloadOffline: data.canDownloadOffline,
        cachedAt: now,
        expiresAt: now + PERMISSION_CACHE_TTL,
      };
      await cachePermission(permission);
      return {
        bookId,
        grantId: data.grantId,
        canComment: data.canComment,
        canDownloadOffline: data.canDownloadOffline,
        isValid: true,
      };
    }
  } catch {
    // Network error - will use cached permission if available
  }

  if (cached) {
    return {
      bookId: cached.bookId,
      grantId: cached.grantId,
      canComment: cached.canComment,
      canDownloadOffline: cached.canDownloadOffline,
      isValid: false,
    };
  }

  return {
    bookId,
    grantId: '',
    canComment: false,
    canDownloadOffline: false,
    isValid: false,
  };
}

export async function getValidPermission(bookId: string): Promise<CachedPermission | null> {
  const permission = await validatePermission(bookId);
  return permission.isValid ? permission : null;
}

export async function revokePermission(bookId: string): Promise<void> {
  await clearPermissionCache(bookId);
}

export async function clearAllPermissions(): Promise<void> {
  await clearAllPermissionCache();
}

export function setupZombieDetection(onRevoked: (bookId: string) => void): () => void {
  let intervalId: ReturnType<typeof setInterval> | null = null;

  const checkPermissions = async (): Promise<void> => {
    if (!navigator.onLine) return;

    try {
      const response = await api.get('/api/access/validate-all');
      if (response.ok) {
        const data = (await response.json()) as { grantIds: string[]; revokedBookIds: string[] };
        const validGrantIds = new Set(data.grantIds);

        const cached = await getCachedPermission('');
        if (cached && !validGrantIds.has(cached.grantId)) {
          for (const bookId of data.revokedBookIds) {
            await clearPermissionCache(bookId);
            onRevoked(bookId);
          }
        }
      }
    } catch {
      // Network error - will retry on next interval
    }
  };

  intervalId = setInterval(() => void checkPermissions(), 60000);

  return () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
}
