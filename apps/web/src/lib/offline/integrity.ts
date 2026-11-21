/**
 * Content integrity helpers for offline downloads (issue #1485).
 *
 * Every required resource is hashed at download time; the hash is recorded in
 * the manifest and re-checked during recovery. SHA-256 via WebCrypto (the
 * test environment installs Node's webcrypto on globalThis).
 */

export interface VerifiedBody {
  sha256: string;
  bytes: number;
}

export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const parts = Array.from(new Uint8Array(digest));
  return parts.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Read a Response body and hash it (consumes the body; pass a clone). */
export async function verifyResponseBody(response: Response): Promise<VerifiedBody> {
  const bytes = await response.arrayBuffer();
  return { sha256: await sha256Hex(bytes), bytes: bytes.byteLength };
}

/** Constant-time-ish hex comparison with equal length (defensive). */
export function hashesEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
