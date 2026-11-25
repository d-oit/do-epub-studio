import { beginDownload, commitDownload, failDownload, getManifest } from './manifest-store';
import { getCacheStorage, isQuotaError, type CacheStorageLike } from './cache';
import { sha256Hex } from './integrity';
import { prepareSpaceFor } from './eviction';
import type { DownloadManifest, DownloadResourceSpec } from './manifest-types';

/**
 * Offline download engine (issue #1485).
 *
 * Downloads are staged in a private cache namespace, integrity-verified, then
 * promoted to the book's serving cache. The manifest only flips to
 * `complete` inside a single IndexedDB transaction (CAS on the attempt id)
 * AFTER the verified copy is in place — so a crash or quota failure at any
 * point leaves either a clean `staging`/`failed` manifest or a fully verified
 * book, never a partial book exposed as complete.
 */

export type OfflineDownloadErrorCode =
  'quota' | 'integrity' | 'network' | 'race' | 'canceled' | 'unauthorized';

export class OfflineDownloadError extends Error {
  readonly code: OfflineDownloadErrorCode;

  constructor(code: OfflineDownloadErrorCode, message: string) {
    super(message);
    this.name = 'OfflineDownloadError';
    this.code = code;
  }
}

export interface ResolvedFileUrl {
  url: string;
  fileId?: string;
  fileSize?: number;
}

export interface DownloadOptions {
  bookId: string;
  /** Server file id (package version) — resolved lazily when not provided. */
  packageVersion?: string;
  resolveFileUrl: () => Promise<ResolvedFileUrl>;
  fetchImpl?: typeof fetch;
  cacheStorage?: CacheStorageLike;
  signal?: AbortSignal;
  onProgress?: (received: number, total: number) => void;
}

function errorCodeOf(err: unknown): OfflineDownloadErrorCode {
  if (isQuotaError(err)) return 'quota';
  if (err && typeof err === 'object' && 'status' in err && typeof err.status === 'number') {
    if (err.status === 401 || err.status === 403) return 'unauthorized';
  }
  if (err instanceof DOMException && err.name === 'AbortError') return 'canceled';
  return 'network';
}

function errorMessageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export async function downloadBookForOffline(options: DownloadOptions): Promise<DownloadManifest> {
  const cacheStorage = options.cacheStorage ?? getCacheStorage();
  if (!cacheStorage) {
    throw new OfflineDownloadError('network', 'CacheStorage is unavailable in this browser');
  }

  const { bookId } = options;

  // Resolve the signed URL before touching the manifest: a 401/403 means the
  // session cannot download this book, and that must not disturb anything.
  let resolved: ResolvedFileUrl;
  try {
    resolved = await options.resolveFileUrl();
  } catch (err) {
    throw new OfflineDownloadError(errorCodeOf(err), errorMessageOf(err));
  }
  const expectedBytes = resolved.fileSize ?? 0;

  let attempt: { attemptId: string; cacheName: string; stagingCacheName: string };
  try {
    attempt = await beginDownload(
      bookId,
      options.packageVersion ?? resolved.fileId ?? bookId,
      expectedBytes,
    );
  } catch (err) {
    throw new OfflineDownloadError(
      'quota',
      `Could not open a download attempt: ${errorMessageOf(err)}`,
    );
  }
  const { attemptId, cacheName, stagingCacheName: staging } = attempt;

  const scrubStaging = async (): Promise<void> => {
    try {
      await cacheStorage.delete(staging);
    } catch {
      // Best-effort; recovery removes leftovers later.
    }
  };

  const markFailed = async (code: OfflineDownloadErrorCode, message: string): Promise<void> => {
    try {
      await failDownload(bookId, attemptId, code, message);
    } catch {
      // Superseded or DB error; nothing else to do.
    }
  };

  try {
    let response: Response;
    try {
      response = await (options.fetchImpl ?? fetch)(resolved.url, {
        signal: options.signal,
      });
    } catch (err) {
      const code = errorCodeOf(err);
      await scrubStaging();
      await markFailed(code, errorMessageOf(err));
      throw new OfflineDownloadError(code, errorMessageOf(err));
    }
    if (!response.ok) {
      const message = `Download failed with status ${response.status}`;
      await scrubStaging();
      await markFailed('network', message);
      throw new OfflineDownloadError('network', message);
    }

    const buffer = await response.arrayBuffer();
    const bytes = buffer.byteLength;
    if (expectedBytes > 0 && expectedBytes !== bytes) {
      const message = `Size mismatch: server reported ${expectedBytes} bytes, got ${bytes}`;
      await scrubStaging();
      await markFailed('integrity', message);
      throw new OfflineDownloadError('integrity', message);
    }
    const sha256 = await sha256Hex(buffer);

    const canned = new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': response.headers.get('content-type') ?? 'application/octet-stream',
        'Content-Length': String(bytes),
      },
    });

    // Make room proactively; a real quota failure still surfaces on put().
    await prepareSpaceFor(bytes, { cacheStorage });

    const stagingCache = await cacheStorage.open(staging);
    try {
      await stagingCache.put(resolved.url, canned.clone());
    } catch (err) {
      const code = errorCodeOf(err);
      await scrubStaging();
      await markFailed(code, errorMessageOf(err));
      throw new OfflineDownloadError(code, errorMessageOf(err));
    }

    // Verify the staged copy before promotion.
    const staged = await stagingCache.match(resolved.url);
    if (!staged) {
      const message = 'Staged resource missing after write';
      await scrubStaging();
      await markFailed('integrity', message);
      throw new OfflineDownloadError('integrity', message);
    }
    const stagedBuffer = await staged.arrayBuffer();
    const stagedHash = await sha256Hex(stagedBuffer);
    if (stagedBuffer.byteLength !== bytes || stagedHash !== sha256) {
      const message = 'Staged resource failed integrity check';
      await scrubStaging();
      await markFailed('integrity', message);
      throw new OfflineDownloadError('integrity', message);
    }

    // Promote the verified copy into the serving cache.
    options.onProgress?.(bytes, expectedBytes || bytes);
    const finalCache = await cacheStorage.open(cacheName);
    await finalCache.put(resolved.url, canned);

    const resource: DownloadResourceSpec = { url: resolved.url, bytes, sha256 };
    const committed = await commitDownload(bookId, attemptId, [resource], bytes);
    if (!committed) {
      await scrubStaging();
      throw new OfflineDownloadError('race', 'Download superseded by a newer attempt');
    }

    await scrubStaging();
    const manifest = await getManifest(bookId);
    if (!manifest || manifest.state !== 'complete') {
      throw new OfflineDownloadError('integrity', 'Manifest did not reach complete state');
    }
    return manifest;
  } catch (err) {
    if (err instanceof OfflineDownloadError) throw err;
    const code = errorCodeOf(err);
    await scrubStaging();
    await markFailed(code, errorMessageOf(err));
    throw new OfflineDownloadError(code, errorMessageOf(err));
  }
}
