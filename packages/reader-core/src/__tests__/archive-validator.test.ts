import { describe, expect, it } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { validateArchive, ArchiveValidationError, MAX_COMPRESSED_SIZE } from '../archive-validator';

describe('ArchiveValidator', () => {
  it('accepts a valid ZIP archive', async () => {
    const data = zipSync({
      'test.txt': strToU8('hello world'),
      'folder/file.css': strToU8('body { color: red; }'),
    });
    await expect(validateArchive(data)).resolves.not.toThrow();
  });

  it('rejects an archive that exceeds max compressed size', async () => {
    const largeData = new Uint8Array(MAX_COMPRESSED_SIZE + 1);
    await expect(validateArchive(largeData)).rejects.toThrow(ArchiveValidationError);
    await expect(validateArchive(largeData)).rejects.toThrow('Archive exceeds maximum compressed size');
  });

  it('rejects path traversal with ..', async () => {
    const data = zipSync({
      '../../etc/passwd': strToU8('malicious'),
    });
    await expect(validateArchive(data)).rejects.toThrow(ArchiveValidationError);
    await expect(validateArchive(data)).rejects.toThrow('Potential path traversal');
  });

  it('rejects absolute paths starting with /', async () => {
    const data = zipSync({
      '/absolute/path.txt': strToU8('malicious'),
    });
    await expect(validateArchive(data)).rejects.toThrow(ArchiveValidationError);
    await expect(validateArchive(data)).rejects.toThrow('Potential path traversal');
  });

  it('rejects high compression ratios (potential ZIP bomb)', async () => {
    const size = 1024 * 1024; // 1MB
    const highlyCompressible = new Uint8Array(size);
    const data = zipSync({
      'bomb.txt': [highlyCompressible, { level: 9 }],
    });

    await expect(validateArchive(data)).rejects.toThrow(ArchiveValidationError);
    await expect(validateArchive(data)).rejects.toThrow('Compression ratio too high');
  });

  it('rejects corrupt ZIP archives', async () => {
    const corruptData = strToU8('not a zip file');
    await expect(validateArchive(corruptData)).rejects.toThrow(ArchiveValidationError);
  });
});
