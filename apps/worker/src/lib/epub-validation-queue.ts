import { execute, queryFirst } from '../db/client';
import type { Env } from './env';
import { EpubRunnerResultSchema, EPUBCHECK_VERSION } from '@do-epub-studio/schema';

export interface EpubValidationMessage {
  bookId: string;
  revisionId: string;
}

export async function enqueueEpubValidation(
  env: Env,
  message: EpubValidationMessage,
): Promise<void> {
  if (!env.EPUB_VALIDATION_QUEUE) return;
  await env.EPUB_VALIDATION_QUEUE.send(message);
}
function getValidatedRunnerUrl(rawUrl: string): URL {
  const parsed = new URL(rawUrl);
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('invalid_runner_url');
  }
  return new URL('/validate', parsed.origin);
}

export async function processEpubValidationQueue(
  batch: MessageBatch<EpubValidationMessage>,
  env: Env,
): Promise<void> {
  for (const message of batch.messages) {
    try {
      await validateRevision(env, message.body);
      message.ack();
    } catch {
      if (message.attempts >= 5) {
        await execute(
          env,
          `UPDATE epub_validation_reports SET status = 'failed', failure_code = 'RUNNER_UNAVAILABLE', updated_at = ? WHERE revision_id = ? AND status = 'pending'`,
          [new Date().toISOString(), message.body.revisionId],
        );
        message.ack();
      } else {
        message.retry({ delaySeconds: Math.min(60 * 2 ** message.attempts, 3600) });
      }
    }
  }
}

async function validateRevision(env: Env, message: EpubValidationMessage): Promise<void> {
  const row = await queryFirst<{
    id: string;
    storage_key: string;
    file_size_bytes: number;
    bytes_sha256: string | null;
    status: string;
    validator_version: string;
  }>(
    env,
    `SELECT r.id, f.storage_key, f.file_size_bytes, r.bytes_sha256, r.status, r.validator_version
     FROM epub_validation_reports r JOIN book_files f ON f.id = r.revision_id
     WHERE r.revision_id = ? AND r.book_id = ? ORDER BY r.updated_at DESC LIMIT 1`,
    [message.revisionId, message.bookId],
  );
  if (
    !row ||
    (row.status === 'completed' && row.bytes_sha256 && row.validator_version === EPUBCHECK_VERSION)
  )
    return;
  if (!env.EPUBCHECK_RUNNER_URL || !env.EPUBCHECK_RUNNER_TOKEN)
    throw new Error('runner_unavailable');
  const object = await env.BOOKS_BUCKET.get(row.storage_key);
  if (!object || object.size > 100 * 1024 * 1024 || object.size !== row.file_size_bytes)
    throw new Error('source_unavailable');

  const endpoint = getValidatedRunnerUrl(env.EPUBCHECK_RUNNER_URL);
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.EPUBCHECK_RUNNER_TOKEN}`,
      'content-type': 'application/epub+zip',
      'content-length': String(object.size),
    },
    body: object.body,
  });
  if (!response.ok) throw new Error('runner_unavailable');
  const text = await response.text();
  if (text.length > 300_000) throw new Error('runner_response_limit');
  const raw: unknown = JSON.parse(text);
  const safetyStatus =
    raw && typeof raw === 'object' && 'safetyStatus' in raw ? raw.safetyStatus : null;
  if (safetyStatus === 'rejected') {
    await execute(
      env,
      `UPDATE epub_validation_reports SET status = 'failed', safety_status = 'rejected', failure_code = 'ARCHIVE_SAFETY_REJECTED', updated_at = ? WHERE revision_id = ?`,
      [new Date().toISOString(), message.revisionId],
    );
    return;
  }
  const result = EpubRunnerResultSchema.parse(raw);
  const now = new Date().toISOString();
  const report = JSON.stringify(result);
  await execute(
    env,
    `UPDATE epub_validation_reports SET bytes_sha256 = ?, validator_version = ?, status = 'completed', safety_status = 'accepted', epub_version = ?, findings_json = ?, accessibility_json = ?, failure_code = NULL, attempt_count = MIN(attempt_count + 1, 100), updated_at = ? WHERE revision_id = ?`,
    [
      result.sha256,
      result.validatorVersion,
      result.epubVersion,
      JSON.stringify(result.findings),
      JSON.stringify(result.accessibility),
      now,
      message.revisionId,
    ],
  );
  await execute(env, 'UPDATE book_files SET sha256 = ?, epub_version = ? WHERE id = ?', [
    result.sha256,
    result.epubVersion,
    message.revisionId,
  ]);
  void report;
}
