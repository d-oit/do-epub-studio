import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import {
  validateArchive,
  ArchiveValidationError,
  MAX_COMPRESSED_SIZE,
  MAX_ENTRY_COUNT,
} from '../archive-validator';

describe('shared archive safety boundary', () => {
  it('accepts a valid archive', async () => {
    await expect(
      validateArchive(zipSync({ mimetype: strToU8('application/epub+zip') })),
    ).resolves.toBeUndefined();
  });

  it('rejects oversized, malformed, unsafe, high-ratio and excessive-entry archives', async () => {
    await expect(validateArchive(new Uint8Array(MAX_COMPRESSED_SIZE + 1))).rejects.toBeInstanceOf(
      ArchiveValidationError,
    );
    await expect(validateArchive(strToU8('not a zip'))).rejects.toBeInstanceOf(
      ArchiveValidationError,
    );
    await expect(validateArchive(zipSync({ '../outside': strToU8('x') }))).rejects.toThrow(
      'Potential path traversal',
    );
    await expect(validateArchive(zipSync({ '/outside': strToU8('x') }))).rejects.toThrow(
      'Potential path traversal',
    );
    await expect(
      validateArchive(zipSync({ bomb: [new Uint8Array(1024 * 1024), { level: 9 }] })),
    ).rejects.toThrow('Compression ratio too high');
    const entries = Object.fromEntries(
      Array.from({ length: MAX_ENTRY_COUNT + 1 }, (_, i) => [`${i}.txt`, strToU8('x')]),
    );
    await expect(validateArchive(zipSync(entries))).rejects.toThrow('too many entries');
  });
});
