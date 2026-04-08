import type { Env } from '../lib/env';

export interface SignedUrlResponse {
  url: string;
  expiresAt: string;
  fileSize: number;
  mimeType: string;
}

const SIGNED_URL_EXPIRY_SECONDS = 3600;

async function computeSignature(
  secret: string,
  bookId: string,
  fileKey: string,
  expiresEpoch: number,
): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${bookId}:${fileKey}:${expiresEpoch}:${secret}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function generateSignedUrl(
  env: Env,
  bookId: string,
  fileKey: string,
): Promise<SignedUrlResponse> {
  const object = await env.BOOKS_BUCKET.get(fileKey);

  if (!object) {
    throw new Error('File not found in storage');
  }

  const expiresAt = new Date(Date.now() + SIGNED_URL_EXPIRY_SECONDS * 1000);
  const expiresEpoch = Math.floor(expiresAt.getTime() / 1000);
  const signature = await computeSignature(
    env.SESSION_SIGNING_SECRET,
    bookId,
    fileKey,
    expiresEpoch,
  );

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

  const expected = await computeSignature(
    env.SESSION_SIGNING_SECRET,
    bookId,
    fileKey,
    expiresEpoch,
  );
  return expected === providedSignature;
}
