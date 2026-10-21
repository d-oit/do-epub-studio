import {
  cachePermission,
  getCachedPermission,
  getAllCachedPermissions,
  clearPermissionCache,
  clearAllPermissionCache,
  type PermissionCache,
} from './db';
import { api } from '../api';
import { useAuthStore } from '@/stores/auth';

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
    // `/api/access/validate` resolves the session from the bearer token, so
    // the check must carry it; without it the server answers 401 and the
    // permission is never refreshed from the server.
    const sessionToken = useAuthStore.getState().sessionToken;
    if (!sessionToken) throw new Error('Session expired');
    const response = await api.get(`/api/access/validate?bookId=${bookId}`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    if (response.ok) {
      // The worker answers with the standard `{ ok, data }` envelope, so the
      // payload lives under `data`. Reading the envelope directly yields
      // `undefined` for every field.
      const envelope = (await response.json()) as {
        data: { grantId: string; canComment: boolean; canDownloadOffline: boolean };
      };
      const data = envelope.data;
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

export function setupZombieDetection(
  sessionToken: string,
  onRevoked: (bookId: string) => void,
): () => void {
  let intervalId: ReturnType<typeof setInterval> | null = null;

  const checkPermissions = async (): Promise<void> => {
    if (!navigator.onLine) return;

    try {
      const response = await api.get('/api/access/validate-all', {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (response.ok) {
        // The worker answers with the standard `{ ok, data }` envelope, so the
        // payload lives under `data`. Reading the envelope directly made
        // `new Set(undefined)` throw, and the surrounding catch swallowed it —
        // so a revoked grant was never detected and the poll silently did
        // nothing on every interval.
        const envelope = (await response.json()) as {
          data: { grantIds: string[]; revokedBookIds: string[] };
        };
        const data = envelope.data;
        const validGrantIds = new Set(data.grantIds);
        const revokedBookIds = new Set(data.revokedBookIds);

        const cachedPermissions = await getAllCachedPermissions();
        for (const cached of cachedPermissions) {
          if (revokedBookIds.has(cached.bookId) || !validGrantIds.has(cached.grantId)) {
            await clearPermissionCache(cached.bookId);
            onRevoked(cached.bookId);
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
