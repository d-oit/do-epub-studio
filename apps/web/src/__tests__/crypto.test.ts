import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, encryptJSON, decryptJSON } from '../lib/offline/crypto';

const TEST_TOKEN = 'test-session-token-12345';
const TEST_TOKEN_2 = 'different-session-token-67890';

describe('Encryption', () => {
  it('should encrypt and decrypt a string', async () => {
    const plaintext = 'Hello, offline world!';
    const ciphertext = await encrypt(plaintext, TEST_TOKEN);
    expect(ciphertext).toBeTruthy();
    expect(ciphertext).not.toBe(plaintext);

    const decrypted = await decrypt(ciphertext, TEST_TOKEN);
    expect(decrypted).toBe(plaintext);
  });

  it('should produce different ciphertexts for the same plaintext each time', async () => {
    const plaintext = 'same data';
    const a = await encrypt(plaintext, TEST_TOKEN);
    const b = await encrypt(plaintext, TEST_TOKEN);
    expect(a).not.toBe(b);
  });

  it('should fail to decrypt with a different token', async () => {
    const plaintext = 'secret data';
    const ciphertext = await encrypt(plaintext, TEST_TOKEN);

    await expect(decrypt(ciphertext, TEST_TOKEN_2)).rejects.toThrow();
  });

  it('should fail to decrypt a tampered ciphertext', async () => {
    const ciphertext = await encrypt('data', TEST_TOKEN);
    const parts = ciphertext.split('');
    parts[5] = parts[5] === 'A' ? 'B' : 'A';
    const tampered = parts.join('');

    await expect(decrypt(tampered, TEST_TOKEN)).rejects.toThrow();
  });

  it('should encrypt and decrypt JSON', async () => {
    const obj = { id: '1', bookId: 'book-1', cfi: '/6/4', percentage: 45 };
    const ciphertext = await encryptJSON(obj, TEST_TOKEN);
    const decrypted = await decryptJSON<typeof obj>(ciphertext, TEST_TOKEN);
    expect(decrypted).toEqual(obj);
  });

  it('should handle empty string', async () => {
    const ciphertext = await encrypt('', TEST_TOKEN);
    const decrypted = await decrypt(ciphertext, TEST_TOKEN);
    expect(decrypted).toBe('');
  });

  it('should handle unicode characters', async () => {
    const unicode = '日本語📚💡';
    const ciphertext = await encrypt(unicode, TEST_TOKEN);
    const decrypted = await decrypt(ciphertext, TEST_TOKEN);
    expect(decrypted).toBe(unicode);
  });

  it('should produce deterministic base64 output', async () => {
    const ciphertext = await encrypt('test', TEST_TOKEN);
    expect(typeof ciphertext).toBe('string');
    expect(ciphertext.length).toBeGreaterThan(0);
    expect(/^[A-Za-z0-9+/=]+$/.test(ciphertext)).toBe(true);
  });
});
