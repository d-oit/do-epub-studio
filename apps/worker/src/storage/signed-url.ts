import type { Env } from '../lib/env';

export interface SignedUrlResponse {
  url: string;
  expiresAt: string;
  fileSize: number;
  mimeType: string;
}

const SIGNED_URL_EXPIRY_SECONDS = 3600;

export async function generateSignedUrl(
  env: Env,
  bookId: string,
  fileKey: string
): Promise<SignedUrlResponse> {
  const bucket = env.BOOKS_BUCKET;
  const object = await bucket.get(fileKey);
  
  if (!object) {
    throw new Error('File not found in storage');
  }

  const expiresAt = new Date(Date.now() + SIGNED_URL_EXPIRY_SECONDS * 1000);
  const expiresEpoch = Math.floor(expiresAt.getTime() / 1000);

  const encoder = new TextEncoder();
  const data = encoder.encode(`${fileKey}:${expiresEpoch}:${env.SESSION_SIGNING_SECRET}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

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
  
  if (isNaN(expiresEpoch)) {
    return false;
  }

  return Date.now() / 1000 <= expiresEpoch;
}
