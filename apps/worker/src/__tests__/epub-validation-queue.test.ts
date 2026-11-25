import { describe, expect, it, vi } from 'vitest';
import { makeEnv, mockQueryFirst, mockExecute } from './fixtures';
import {
  getValidatedRunnerUrl,
  processEpubValidationQueue,
  type EpubValidationMessage,
} from '../lib/epub-validation-queue';
import { EPUBCHECK_VERSION } from '@do-epub-studio/schema';
describe('getValidatedRunnerUrl', () => {
  it('restricts the request to the configured HTTP origin and validation path', () => {
    const endpoint = getValidatedRunnerUrl(
      'https://runner.example/custom/path?token=untrusted#fragment',
    );

    expect(endpoint.href).toBe('https://runner.example/validate');
  });

  it('allows loopback HTTP runner URLs for local development', () => {
    const localhost = getValidatedRunnerUrl('http://localhost:8080/some/path');
    const ip = getValidatedRunnerUrl('http://127.0.0.1:8080/some/path');

    expect(localhost.href).toBe('http://localhost:8080/validate');
    expect(ip.href).toBe('http://127.0.0.1:8080/validate');
  });

  it('allows custom allowed hosts when configured', () => {
    const endpoint = getValidatedRunnerUrl(
      'https://custom-runner.internal/path',
      'runner.example, custom-runner.internal',
    );

    expect(endpoint.href).toBe('https://custom-runner.internal/validate');
  });

  it.each([
    'file:///etc/passwd',
    'ftp://runner.example',
    'http://runner.example',
    'https://untrusted.attacker.com/validate',
    'https://169.254.169.254/latest/meta-data',
    'not-a-valid-url',
  ])('rejects non-allowlisted or insecure URLs: %s', (url) => {
    expect(() => getValidatedRunnerUrl(url)).toThrow('invalid_runner_url');
  });
});
describe('processEpubValidationQueue', () => {
  it('processes validation message and persists real epub version and metadata', async () => {
    const env = makeEnv();
    env.EPUBCHECK_RUNNER_URL = 'https://runner.example';
    env.EPUBCHECK_RUNNER_TOKEN = 'secret-token';

    mockQueryFirst.mockResolvedValueOnce({
      id: 'rep-1',
      storage_key: 'books/b1/rev1.epub',
      file_size_bytes: 100,
      bytes_sha256: null,
      status: 'pending',
      validator_version: EPUBCHECK_VERSION,
    });

    const mockGet = vi.fn().mockResolvedValue({
      size: 100,
      body: new ReadableStream(),
    });
    env.BOOKS_BUCKET.get = mockGet;
    const specRef = {
      spec: 'EPUB Accessibility',
      specUrl: 'https://www.w3.org/TR/epub-a11y-11/',
      version: '1.1',
      status: 'W3C Recommendation',
      statusDate: '2024-10-17',
    };
    const mockResult = {
      validatorVersion: EPUBCHECK_VERSION,
      sha256: 'a'.repeat(64),
      epubVersion: '3.0',
      findings: [],
      accessibility: {
        metadata: [
          { key: 'dc:language', value: 'en', provenance: 'opf' },
          { key: 'schema:accessMode', value: 'textual', provenance: 'opf' },
        ],
        advisories: [],
        manualReviewRequired: true,
        certification: 'not-certified',
        profiles: {
          '1.1': {
            spec: specRef,
            experimental: false,
            certification: 'not-certified',
            findings: [],
            evidence: [],
          },
          '1.2-draft': {
            spec: specRef,
            experimental: true,
            certification: 'not-certified',
            findings: [],
            evidence: [],
          },
        },
      },
      safetyStatus: 'accepted',
      conformanceStatus: 'completed',
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(mockResult)),
    });
    vi.stubGlobal('fetch', fetchMock);

    const message = {
      id: 'msg-1',
      timestamp: new Date(),
      attempts: 1,
      body: { bookId: 'b1', revisionId: 'rev1' },
      ack: vi.fn(),
      retry: vi.fn(),
    };

    const batch = {
      queue: 'validation-queue',
      messages: [message],
      ackAll: vi.fn(),
      retryAll: vi.fn(),
    } as unknown as MessageBatch<EpubValidationMessage>;

    await processEpubValidationQueue(batch, env);

    expect(message.ack).toHaveBeenCalled();
    expect(mockExecute).toHaveBeenCalledWith(
      env,
      expect.stringContaining('UPDATE epub_validation_reports SET bytes_sha256 = ?'),
      expect.arrayContaining(['3.0']),
    );
    expect(mockExecute).toHaveBeenCalledWith(
      env,
      'UPDATE book_files SET sha256 = ?, epub_version = ? WHERE id = ?',
      ['a'.repeat(64), '3.0', 'rev1'],
    );

    vi.unstubAllGlobals();
  });

  it('acks a malformed message on terminal failure without touching the reports table', async () => {
    const env = makeEnv();
    const message = {
      id: 'msg-bad',
      timestamp: new Date(),
      attempts: 5,
      body: { noRevisionId: true },
      ack: vi.fn(),
      retry: vi.fn(),
    };
    mockExecute.mockClear();

    const batch = {
      queue: 'validation-queue',
      messages: [message],
      ackAll: vi.fn(),
      retryAll: vi.fn(),
    } as unknown as MessageBatch<EpubValidationMessage>;

    await processEpubValidationQueue(batch, env);

    expect(message.ack).toHaveBeenCalled();
    expect(message.retry).not.toHaveBeenCalled();
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('marks the report failed on terminal failure for a well-formed message', async () => {
    const env = makeEnv();
    mockExecute.mockClear();
    mockQueryFirst.mockRejectedValueOnce(new Error('runner_unavailable'));

    const message = {
      id: 'msg-term',
      timestamp: new Date(),
      attempts: 5,
      body: { bookId: 'b1', revisionId: 'rev1' },
      ack: vi.fn(),
      retry: vi.fn(),
    };
    const batch = {
      queue: 'validation-queue',
      messages: [message],
      ackAll: vi.fn(),
      retryAll: vi.fn(),
    } as unknown as MessageBatch<EpubValidationMessage>;

    await processEpubValidationQueue(batch, env);

    expect(message.ack).toHaveBeenCalled();
    expect(mockExecute).toHaveBeenCalledWith(
      env,
      expect.stringContaining("SET status = 'failed', failure_code = 'RUNNER_UNAVAILABLE'"),
      [expect.any(String), 'rev1'],
    );
  });
});
