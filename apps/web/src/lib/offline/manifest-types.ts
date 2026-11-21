/**
 * Per-book download manifest (issue #1485).
 *
 * A manifest is the single source of truth for whether a book is available
 * offline. A book is claimed offline-ready only when its manifest is in the
 * `complete` state AND every required resource is present (and verified) in
 * the serving cache named by `cacheName`.
 */

export type DownloadManifestState = 'staging' | 'complete' | 'failed';

/** A single required resource, verified at download time. */
export interface DownloadResourceSpec {
  /** Absolute URL the resource is served from (the signed file URL). */
  url: string;
  /** Verified body size in bytes. */
  bytes: number;
  /** SHA-256 of the verified body (hex). */
  sha256: string;
}

export interface DownloadManifestFailure {
  /** Stable machine-readable code: quota | integrity | network | race | interrupted. */
  code: string;
  message: string;
  at: number;
}

export interface DownloadManifest {
  /** Key; the book id from the reader APIs. */
  bookId: string;
  /** Package version: the server file id this download was taken from. */
  packageVersion: string;
  /** Current download attempt id (UUID). CAS-protects commit/fail. */
  attemptId: string;
  state: DownloadManifestState;
  /** Verified resources. Empty while staging / after a failed attempt. */
  resources: DownloadResourceSpec[];
  /** Sum of resource bytes (verified). */
  totalBytes: number;
  /** Expected size from the server (0 when unknown) — used as a sanity bound. */
  expectedBytes: number;
  /**
   * Serving cache name (`dl/<bookId>`). Reading traffic is served from here
   * only when the manifest is complete.
   */
  cacheName: string;
  /**
   * Staging cache name of the current/last attempt (`dl-staging/<bookId>/<attemptId>`).
   * Kept until the staging cache is deleted, so recovery can clean leftovers.
   */
  stagingCacheName: string | null;
  /** LRU timestamp for book-package eviction (updated on access/read). */
  lastAccess: number;
  createdAt: number;
  updatedAt: number;
  failure?: DownloadManifestFailure;
}

import { isRecord } from './guards';

const VALID_STATES = new Set<DownloadManifestState>(['staging', 'complete', 'failed']);

function isResource(value: unknown): value is DownloadResourceSpec {
  return (
    isRecord(value) &&
    typeof value.url === 'string' &&
    typeof value.bytes === 'number' &&
    typeof value.sha256 === 'string'
  );
}

function isFailure(value: unknown): value is DownloadManifestFailure {
  return (
    isRecord(value) &&
    typeof value.code === 'string' &&
    typeof value.message === 'string' &&
    typeof value.at === 'number'
  );
}

/**
 * Runtime guard for persisted manifest rows (device-internal, but written
 * across app versions). Returns null for anything missing a required field or
 * carrying a wrong type, so callers treat corrupt rows as absent.
 */
export function parseDownloadManifest(raw: unknown): DownloadManifest | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.bookId !== 'string') return null;
  if (typeof raw.packageVersion !== 'string') return null;
  if (typeof raw.state !== 'string' || !VALID_STATES.has(raw.state as DownloadManifestState)) {
    return null;
  }
  if (!Array.isArray(raw.resources) || !raw.resources.every(isResource)) return null;
  if (typeof raw.totalBytes !== 'number') return null;
  if (typeof raw.expectedBytes !== 'number') return null;
  if (typeof raw.cacheName !== 'string') return null;
  if (raw.stagingCacheName !== null && typeof raw.stagingCacheName !== 'string') return null;
  if (typeof raw.lastAccess !== 'number') return null;
  if (typeof raw.createdAt !== 'number') return null;
  if (typeof raw.updatedAt !== 'number') return null;
  if (raw.failure !== undefined && !isFailure(raw.failure)) return null;

  return {
    bookId: raw.bookId,
    packageVersion: raw.packageVersion,
    attemptId: raw.attemptId as string,
    state: raw.state as DownloadManifestState,
    resources: raw.resources,
    totalBytes: raw.totalBytes,
    expectedBytes: raw.expectedBytes,
    cacheName: raw.cacheName,
    stagingCacheName: raw.stagingCacheName,
    lastAccess: raw.lastAccess,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    failure: raw.failure,
  };
}
