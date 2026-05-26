const ALGORITHM = 'AES-GCM';
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const ITERATIONS = 100_000;
const KEY_LENGTH = 256;

function uint8arrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const result = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    result[i] = binary.charCodeAt(i);
  }
  return result;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function textToArrayBuffer(text: string): ArrayBuffer {
  const encoded = new TextEncoder().encode(text);
  return toArrayBuffer(encoded);
}

async function getSubtle(): Promise<SubtleCrypto> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    return crypto.subtle;
  }
  const { webcrypto } = await import('node:crypto');
  return webcrypto.subtle as unknown as SubtleCrypto;
}

async function deriveKey(token: string, salt: ArrayBuffer): Promise<CryptoKey> {
  const subtle = await getSubtle();
  const keyMaterial = await subtle.importKey(
    'raw',
    textToArrayBuffer(token),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  );

  return subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encrypt(plaintext: string, token: string): Promise<string> {
  const subtle = await getSubtle();
  const salt = toArrayBuffer(crypto.getRandomValues(new Uint8Array(SALT_LENGTH)));
  const iv = toArrayBuffer(crypto.getRandomValues(new Uint8Array(IV_LENGTH)));
  const key = await deriveKey(token, salt);

  const encrypted = await subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    textToArrayBuffer(plaintext),
  );

  const combined = new Uint8Array(SALT_LENGTH + IV_LENGTH + encrypted.byteLength);
  combined.set(new Uint8Array(salt), 0);
  combined.set(new Uint8Array(iv), SALT_LENGTH);
  combined.set(new Uint8Array(encrypted), SALT_LENGTH + IV_LENGTH);

  return uint8arrayToBase64(combined);
}

export async function decrypt(ciphertext: string, token: string): Promise<string> {
  const subtle = await getSubtle();
  const combined = base64ToUint8Array(ciphertext);
  const salt = toArrayBuffer(combined.slice(0, SALT_LENGTH));
  const iv = toArrayBuffer(combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH));
  const data = toArrayBuffer(combined.slice(SALT_LENGTH + IV_LENGTH));

  const key = await deriveKey(token, salt);

  const decrypted = await subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    data,
  );

  return new TextDecoder().decode(decrypted);
}

export async function encryptJSON<T>(value: T, token: string): Promise<string> {
  return encrypt(JSON.stringify(value), token);
}

export async function decryptJSON<T>(ciphertext: string, token: string): Promise<T> {
  return JSON.parse(await decrypt(ciphertext, token)) as T;
}
