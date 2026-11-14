import { EpubRunnerResultSchema } from '@do-epub-studio/schema';
import {
  exportAnnotationsToEpub,
  EpubAnnotationExportError,
  EPUB_ANNOTATION_EXPORT_LIMITS,
} from '@do-epub-studio/reader-core/packager';
import { queryFirst } from '../db/client';
import { readUserAnnotations } from './epub-annotation-reader';
import { getValidatedRunnerUrl } from './epub-validation-queue';
import type { Env, JsonRow } from './env';

const MAX_RUNNER_RESPONSE_BYTES = 300_000;
const RUNNER_TIMEOUT_MS = 125_000;

export type EpubAnnotationExportFailureCode =
  | 'SOURCE_NOT_FOUND'
  | 'SOURCE_UNAVAILABLE'
  | 'EPUBCHECK_UNAVAILABLE'
  | 'EPUBCHECK_INVALID_RESPONSE'
  | 'EPUBCHECK_INTEGRITY_ERROR'
  | 'EPUBCHECK_REJECTED';

export class EpubAnnotationExportFailure extends Error {
  constructor(
    readonly code: EpubAnnotationExportFailureCode,
    message: string,
  ) {
    super(message);
    this.name = 'EpubAnnotationExportFailure';
  }
}

interface SourceRevisionRow extends JsonRow {
  id: string;
  storage_key: string;
  file_size_bytes: number;
}

async function sha256Hex(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  let value = '';
  for (const byte of digest) value += byte.toString(16).padStart(2, '0');
  return value;
}

async function readRunnerResponse(response: Response): Promise<Uint8Array> {
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      byteLength += value.byteLength;
      if (byteLength > MAX_RUNNER_RESPONSE_BYTES) {
        await reader.cancel().catch(() => {});
        throw new EpubAnnotationExportFailure(
          'EPUBCHECK_INVALID_RESPONSE',
          'The EPUBCheck runner response exceeded its size limit',
        );
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof EpubAnnotationExportFailure) throw error;
    throw new EpubAnnotationExportFailure(
      'EPUBCHECK_UNAVAILABLE',
      'The EPUBCheck runner response could not be read',
    );
  }

  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function parseRunnerJson(bytes: Uint8Array): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new TypeError();
    return parsed as Record<string, unknown>;
  } catch {
    throw new EpubAnnotationExportFailure(
      'EPUBCHECK_INVALID_RESPONSE',
      'The EPUBCheck runner returned malformed JSON',
    );
  }
}

async function validateWithEpubCheck(env: Env, epub: Uint8Array<ArrayBuffer>): Promise<void> {
  if (!env.EPUBCHECK_RUNNER_URL || !env.EPUBCHECK_RUNNER_TOKEN) {
    throw new EpubAnnotationExportFailure(
      'EPUBCHECK_UNAVAILABLE',
      'The EPUBCheck runner is not configured',
    );
  }

  let endpoint: URL;
  try {
    endpoint = getValidatedRunnerUrl(env.EPUBCHECK_RUNNER_URL, env.EPUBCHECK_RUNNER_ALLOWED_HOSTS);
  } catch {
    throw new EpubAnnotationExportFailure(
      'EPUBCHECK_UNAVAILABLE',
      'The EPUBCheck runner URL is invalid',
    );
  }

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.EPUBCHECK_RUNNER_TOKEN}`,
        'content-type': 'application/epub+zip',
        'content-length': String(epub.byteLength),
      },
      body: epub,
      signal: AbortSignal.timeout(RUNNER_TIMEOUT_MS),
    });
  } catch {
    throw new EpubAnnotationExportFailure(
      'EPUBCHECK_UNAVAILABLE',
      'The EPUBCheck runner could not be reached',
    );
  }

  if (!response.ok && response.status !== 422) {
    throw new EpubAnnotationExportFailure(
      'EPUBCHECK_UNAVAILABLE',
      'The EPUBCheck runner did not accept the request',
    );
  }
  const raw = parseRunnerJson(await readRunnerResponse(response));
  if (raw.safetyStatus === 'rejected') {
    throw new EpubAnnotationExportFailure(
      'EPUBCHECK_REJECTED',
      'The generated EPUB failed archive safety validation',
    );
  }
  if (raw.conformanceStatus !== 'completed') {
    throw new EpubAnnotationExportFailure(
      raw.conformanceStatus === 'failed' ? 'EPUBCHECK_REJECTED' : 'EPUBCHECK_INVALID_RESPONSE',
      'The EPUBCheck runner did not report successful conformance',
    );
  }
  if (!response.ok || raw.safetyStatus !== 'accepted') {
    throw new EpubAnnotationExportFailure(
      'EPUBCHECK_INVALID_RESPONSE',
      'The EPUBCheck runner returned an unexpected validation status',
    );
  }

  const result = EpubRunnerResultSchema.safeParse(raw);
  if (!result.success) {
    throw new EpubAnnotationExportFailure(
      'EPUBCHECK_INVALID_RESPONSE',
      'The EPUBCheck runner returned a malformed validation result',
    );
  }
  if (result.data.sha256 !== (await sha256Hex(epub))) {
    throw new EpubAnnotationExportFailure(
      'EPUBCHECK_INTEGRITY_ERROR',
      'The EPUBCheck runner validated different bytes',
    );
  }
  if (result.data.findings.some((finding) => finding.severity === 'error')) {
    throw new EpubAnnotationExportFailure(
      'EPUBCHECK_REJECTED',
      'The generated EPUB has EPUBCheck error findings',
    );
  }
}

export async function createValidatedAnnotationEpub(
  env: Env,
  bookId: string,
  userEmail: string,
): Promise<Uint8Array<ArrayBuffer>> {
  const revision = await queryFirst<SourceRevisionRow>(
    env,
    `SELECT id, storage_key, file_size_bytes FROM book_files
     WHERE book_id = ? ORDER BY created_at DESC LIMIT 1`,
    [bookId],
  );
  if (!revision) {
    throw new EpubAnnotationExportFailure(
      'SOURCE_NOT_FOUND',
      'No EPUB revision is available for this book',
    );
  }
  if (
    !revision.id ||
    !revision.storage_key ||
    !Number.isSafeInteger(revision.file_size_bytes) ||
    revision.file_size_bytes <= 0
  ) {
    throw new EpubAnnotationExportFailure(
      'SOURCE_UNAVAILABLE',
      'The latest EPUB revision metadata is invalid',
    );
  }
  if (revision.file_size_bytes > EPUB_ANNOTATION_EXPORT_LIMITS.maxSourceCompressedBytes) {
    throw new EpubAnnotationExportError(
      'SOURCE_TOO_LARGE',
      'The source EPUB exceeds the 8 MiB limit',
    );
  }

  const annotations = await readUserAnnotations(env, bookId, userEmail);
  let object: R2ObjectBody | null;
  try {
    object = await env.BOOKS_BUCKET.get(revision.storage_key);
  } catch {
    throw new EpubAnnotationExportFailure(
      'SOURCE_UNAVAILABLE',
      'The latest EPUB revision could not be read',
    );
  }
  if (!object || object.size !== revision.file_size_bytes) {
    throw new EpubAnnotationExportFailure(
      'SOURCE_UNAVAILABLE',
      'The latest EPUB revision size does not match its stored metadata',
    );
  }

  let sourceBytes: Uint8Array;
  try {
    sourceBytes = new Uint8Array(await object.arrayBuffer());
  } catch {
    throw new EpubAnnotationExportFailure(
      'SOURCE_UNAVAILABLE',
      'The latest EPUB revision could not be read',
    );
  }
  if (sourceBytes.byteLength !== revision.file_size_bytes) {
    throw new EpubAnnotationExportFailure(
      'SOURCE_UNAVAILABLE',
      'The latest EPUB revision changed while it was being read',
    );
  }

  const epub = await exportAnnotationsToEpub(sourceBytes, annotations, { revisionId: revision.id });
  await validateWithEpubCheck(env, epub);
  return epub;
}
