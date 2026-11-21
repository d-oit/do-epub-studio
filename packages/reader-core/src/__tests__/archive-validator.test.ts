import { describe, expect, it } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import {
  validateArchive,
  ArchiveRejectionError,
  DEFAULT_INGEST_LIMITS,
} from '../archive-validator';

describe('ArchiveValidator (reader import boundary)', () => {
  it('accepts a valid ZIP archive', async () => {
    const data = zipSync({
      'test.txt': strToU8('hello world'),
      'folder/file.css': strToU8('body { color: red; }'),
    });
    await expect(validateArchive(data)).resolves.not.toThrow();
  });

  it('rejects an archive that exceeds max compressed size', async () => {
    const largeData = new Uint8Array(DEFAULT_INGEST_LIMITS.maxCompressedBytes + 1);
    const error = await rejectionOf(validateArchive(largeData));
    expect(error.code).toBe('compressed-size');
  });

  it('rejects path traversal with ..', async () => {
    const data = zipSync({ '../../etc/passwd': strToU8('malicious') });
    const error = await rejectionOf(validateArchive(data));
    expect(error.code).toBe('unsafe-path');
  });

  it('rejects absolute paths starting with /', async () => {
    const data = zipSync({ '/absolute/path.txt': strToU8('malicious') });
    const error = await rejectionOf(validateArchive(data));
    expect(error.code).toBe('unsafe-path');
  });

  it('rejects high compression ratios (potential ZIP bomb)', async () => {
    const size = 1024 * 1024;
    const highlyCompressible = new Uint8Array(size);
    const data = zipSync({ bomb: [highlyCompressible, { level: 9 }] });
    const error = await rejectionOf(validateArchive(data));
    expect(error.code).toBe('ratio');
  });

  it('rejects corrupt ZIP archives', async () => {
    const corruptData = strToU8('not a zip file');
    const error = await rejectionOf(validateArchive(corruptData));
    expect(error.code).toBe('invalid-archive');
  });

  it('rejections are deterministic and user-readable', async () => {
    const bad = zipSync({ '../up': strToU8('x') });
    const first = await rejectionOf(validateArchive(bad));
    const second = await rejectionOf(validateArchive(bad));
    expect(first.code).toBe(second.code);
    expect(first.message).toBe(second.message);
    expect(first.message).not.toMatch(/inner|stack|at /i);
  });
});

async function rejectionOf(promise: Promise<void>): Promise<ArchiveRejectionError> {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(ArchiveRejectionError);
  return error as ArchiveRejectionError;
}
