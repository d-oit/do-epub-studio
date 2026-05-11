import type { Env } from '../lib/env';

export interface SignedUrlResponse {
  url: string;
  expiresAt: string;
  fileSize: number;
  mimeType: string;
}

const SIGNED_URL_EXPIRY_SECONDS = 3600;

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

  return {
    url: signedUrl,
    expiresAt: expiresAt.toISOString(),
    fileSize: 0,
    mimeType: 'application/epub+zip',
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
