import type { Env } from '../lib/env';
import type { SignedUrlResponse } from '@do-epub-studio/shared';

export type { SignedUrlResponse };

const SIGNED_URL_EXPIRY_SECONDS = 3600;
const HEAD_METADATA_CACHE_MAX = 200;
const HEAD_METADATA_TTL_MS = SIGNED_URL_EXPIRY_SECONDS * 1000;
const FALLBACK_MIME_TYPE = 'application/epub+zip';
const FALLBACK_FILE_SIZE = 0;

interface HeadCacheEntry {
  fileSize: number;
  mimeType: string;
  expiresAt: number;
}

const headCache = new Map<string, HeadCacheEntry>();

function cacheGet(key: string): HeadCacheEntry | null {
  const entry = headCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    headCache.delete(key);
    return null;
  }
  // LRU: refresh insertion order so a re-read keeps the entry hot.
  headCache.delete(key);
  headCache.set(key, entry);
  return entry;
}

function cacheSet(key: string, value: Omit<HeadCacheEntry, 'expiresAt'>): void {
  if (headCache.size >= HEAD_METADATA_CACHE_MAX) {
    const oldest = headCache.keys().next().value;
    if (oldest) headCache.delete(oldest);
  }
  headCache.set(key, { ...value, expiresAt: Date.now() + HEAD_METADATA_TTL_MS });
}

async function readObjectMetadata(
  env: Env,
  bookId: string,
  fileKey: string,
): Promise<{ fileSize: number; mimeType: string } | null> {
  const cacheKey = `${bookId}:${fileKey}`;
  const cached = cacheGet(cacheKey);
  if (cached) {
    return { fileSize: cached.fileSize, mimeType: cached.mimeType };
  }
  try {
    const obj = await env.BOOKS_BUCKET.head(fileKey);
    if (!obj) {
      return null;
    }
    const mimeType = obj.httpMetadata?.contentType || FALLBACK_MIME_TYPE;
    const fileSize = typeof obj.size === 'number' ? obj.size : FALLBACK_FILE_SIZE;
    cacheSet(cacheKey, { fileSize, mimeType });
    return { fileSize, mimeType };
  } catch {
    // R2 may transiently fail; fall back to the safe default rather than
    // failing the entire signed URL request.
    return null;
  }
}

async function getHmacKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  return crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

function hexToUint8Array(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) return new Uint8Array(0);
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

function uint8ArrayToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function generateSignedUrl(
  env: Env,
  bookId: string,
  fileKey: string,
): Promise<SignedUrlResponse> {
  const expiresAt = new Date(Date.now() + SIGNED_URL_EXPIRY_SECONDS * 1000);
  const expiresEpoch = Math.floor(expiresAt.getTime() / 1000);

  const encoder = new TextEncoder();
  const data = encoder.encode(`${bookId}:${fileKey}:${expiresEpoch}`);
  const key = await getHmacKey(env.SESSION_SIGNING_SECRET);
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, data);
  const signature = uint8ArrayToHex(new Uint8Array(signatureBuffer));

  const baseUrl = `${env.APP_BASE_URL}/api/files/${bookId}/${fileKey}`;
  const signedUrl = `${baseUrl}?expires=${expiresEpoch}&signature=${signature}`;

  const meta = await readObjectMetadata(env, bookId, fileKey);

  return {
    url: signedUrl,
    expiresAt: expiresAt.toISOString(),
    fileSize: meta?.fileSize ?? FALLBACK_FILE_SIZE,
    mimeType: meta?.mimeType ?? FALLBACK_MIME_TYPE,
  };
}

export function verifySignedUrlExpiry(expires: string): boolean {
  const expiresEpoch = parseInt(expires, 10);

  if (Number.isNaN(expiresEpoch)) {
    return false;
  }

  return Date.now() / 1000 <= expiresEpoch;
}

export async function verifySignedUrlSignature(
  env: Env,
  bookId: string,
  fileKey: string,
  expires: string,
  providedSignature: string,
): Promise<boolean> {
  const expiresEpoch = parseInt(expires, 10);

  if (Number.isNaN(expiresEpoch)) {
    return false;
  }

  if (providedSignature.length !== 64) {
    return false;
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(`${bookId}:${fileKey}:${expiresEpoch}`);
  const key = await getHmacKey(env.SESSION_SIGNING_SECRET);
  const sigBytes = hexToUint8Array(providedSignature);

  try {
    return await crypto.subtle.verify('HMAC', key, sigBytes.buffer as ArrayBuffer, data);
  } catch {
    return false;
  }
}

export function _resetHeadCacheForTests(): void {
  headCache.clear();
}
