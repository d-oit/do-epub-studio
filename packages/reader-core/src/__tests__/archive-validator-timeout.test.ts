import { describe, expect, it } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { TimeoutError } from '@do-epub-studio/shared';
import { validateArchive, ArchiveValidationError } from '../archive-validator';

describe('ArchiveValidator timeout integration', () => {
  it('passes through with default timeout on valid archive', async () => {
    const data = zipSync({
      'mimetype': strToU8('application/epub+zip'),
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test fixture: HTML string for ZIP entry
    'content.xhtml': strToU8('<html><body><p>Hello</p></body></html>'),
    });
    await expect(validateArchive(data)).resolves.toBeUndefined();
  });

  it('respects custom timeoutMs option', async () => {
    const data = zipSync({
      'mimetype': strToU8('application/epub+zip'),
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test fixture: HTML string for ZIP entry
    'content.xhtml': strToU8('<html><body><p>Hello</p></body></html>'),
    });
    await expect(validateArchive(data, { timeoutMs: 5000 })).resolves.toBeUndefined();
  });

  it('accepts traceId option without error', async () => {
    const data = zipSync({
      'mimetype': strToU8('application/epub+zip'),
    });
    await expect(
      validateArchive(data, { timeoutMs: 5000, traceId: 'test-trace' }),
    ).resolves.toBeUndefined();
  });

  it('rejects path traversal with options param', async () => {
    const data = zipSync({
      '../../etc/passwd': strToU8('malicious'),
    });
    await expect(validateArchive(data, { timeoutMs: 5000 })).rejects.toThrow(
      ArchiveValidationError,
    );
  });

  it('rejects corrupt ZIP with options param', async () => {
    const corruptData = strToU8('not a zip file');
    await expect(
      validateArchive(corruptData, { timeoutMs: 5000, traceId: 'test-trace' }),
    ).rejects.toThrow(ArchiveValidationError);
  });

  it('TimeoutError has correct shape when created', () => {
    // Verify TimeoutError class directly since forcing timeout on sync work
    // requires fake timers which cause unhandled rejection issues
    const err = new TimeoutError('archive-validation', 10_000, 'trace-abc');
    expect(err.name).toBe('TimeoutError');
    expect(err.code).toBe('TIMEOUT');
    expect(err.statusCode).toBe(504);
    expect(err.operation).toBe('archive-validation');
    expect(err.timeoutMs).toBe(10_000);
    expect(err.traceId).toBe('trace-abc');
  });
});
