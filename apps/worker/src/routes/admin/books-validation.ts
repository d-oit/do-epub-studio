import type { Context } from 'hono';
import type { Env } from '../../lib/env';
import { execute, queryFirst, queryAll } from '../../db/client';
import { enqueueEpubValidation } from '../../lib/epub-validation-queue';
import { AccessibilityRemediationSchema } from '@do-epub-studio/schema';
import { NotFoundError, ValidationError } from '../../lib/http-errors';

type AdminContext = Context<{
  Bindings: Env;
  Variables: { adminUser: { email: string; id: string; role: string } };
}>;

interface ReportRow extends Record<string, string | number | null | undefined> {
  id: string;
  revision_id: string;
  bytes_sha256: string | null;
  validator_version: string;
  status: string;
  safety_status: string;
  epub_version: string | null;
  findings_json: string;
  accessibility_json: string;
  failure_code: string | null;
  updated_at: string;
}

async function reportFor(c: AdminContext): Promise<ReportRow> {
  const bookId = c.req.param('id') ?? '';
  const revisionId = c.req.param('revisionId') ?? '';
  const report = await queryFirst<ReportRow>(
    c.env,
    `SELECT id, revision_id, bytes_sha256, validator_version, status, safety_status, epub_version,
            findings_json, accessibility_json, failure_code, updated_at
     FROM epub_validation_reports WHERE book_id = ? AND revision_id = ? ORDER BY updated_at DESC LIMIT 1`,
    [bookId, revisionId],
  );
  if (!report) throw new NotFoundError('Validation report');
  return report;
}

function decode<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

export async function handleGetRevisionReport(c: AdminContext): Promise<Response> {
  const report = await reportFor(c);
  const findings = decode<
    Array<{
      severity: string;
      code: string;
      location: string | null;
      path: string | null;
      message: string;
    }>
  >(report.findings_json, []);
  const groups = {
    errors: findings.filter((item) => item.severity === 'error'),
    warnings: findings.filter((item) => item.severity === 'warning'),
    information: findings.filter((item) => item.severity === 'info'),
  };
  const remediation = await queryFirst<{ state_json: string }>(
    c.env,
    'SELECT state_json FROM epub_accessibility_remediation WHERE revision_id = ?',
    [report.revision_id],
  );
  return c.json({
    ok: true,
    data: {
      revisionId: report.revision_id,
      bytesSha256: report.bytes_sha256,
      validatorVersion: report.validator_version,
      status: report.status,
      safetyStatus: report.safety_status,
      epubVersion: report.epub_version,
      groups,
      accessibility: decode(report.accessibility_json, {
        metadata: [],
        advisories: [],
        manualReviewRequired: true,
        certification: 'not-certified',
      }),
      remediation: decode(remediation?.state_json ?? '{}', {}),
      failureCode: report.failure_code,
      updatedAt: report.updated_at,
    },
  });
}

export async function handleDownloadRevisionReport(c: AdminContext): Promise<Response> {
  const report = await reportFor(c);
  const body = {
    revisionId: report.revision_id,
    bytesSha256: report.bytes_sha256,
    validatorVersion: report.validator_version,
    status: report.status,
    safetyStatus: report.safety_status,
    epubVersion: report.epub_version,
    findings: decode(report.findings_json, []),
    accessibility: decode(report.accessibility_json, {}),
    failureCode: report.failure_code,
    updatedAt: report.updated_at,
    certification: 'not-certified',
  };
  return c.body(JSON.stringify(body, null, 2), 200, {
    'content-type': 'application/json; charset=utf-8',
    'content-disposition': 'attachment; filename="epub-validation-report.json"',
    'cache-control': 'no-store',
  });
}

export async function handleRetryRevisionValidation(c: AdminContext): Promise<Response> {
  const report = await reportFor(c);
  await execute(
    c.env,
    `UPDATE epub_validation_reports SET status = 'pending', safety_status = 'pending', failure_code = NULL,
     attempt_count = MIN(attempt_count + 1, 100), updated_at = ? WHERE id = ?`,
    [new Date().toISOString(), report.id],
  );
  await enqueueEpubValidation(c.env, {
    bookId: c.req.param('id') ?? '',
    revisionId: report.revision_id,
  });
  return c.json({ ok: true, data: { revisionId: report.revision_id, status: 'pending' } }, 202);
}

export async function handleUpdateRevisionRemediation(
  c: AdminContext,
  input: unknown,
): Promise<Response> {
  const state = AccessibilityRemediationSchema.safeParse(input);
  if (!state.success) throw new ValidationError('Invalid accessibility remediation state');
  const report = await reportFor(c);
  const now = new Date().toISOString();
  await execute(
    c.env,
    `INSERT INTO epub_accessibility_remediation (revision_id, state_json, updated_by, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(revision_id) DO UPDATE SET state_json = excluded.state_json, updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
    [report.revision_id, JSON.stringify(state.data), c.get('adminUser').id, now],
  );
  return c.json({
    ok: true,
    data: { revisionId: report.revision_id, remediation: state.data, updatedAt: now },
  });
}

export async function handleListRevisionReports(c: AdminContext): Promise<Response> {
  const rows = await queryAll<ReportRow>(
    c.env,
    `SELECT id, revision_id, bytes_sha256, validator_version, status, safety_status, epub_version,
            findings_json, accessibility_json, failure_code, updated_at
     FROM epub_validation_reports WHERE book_id = ? ORDER BY updated_at DESC`,
    [c.req.param('id') ?? ''],
  );
  return c.json({
    ok: true,
    data: rows.map((row) => ({
      revisionId: row.revision_id,
      bytesSha256: row.bytes_sha256,
      validatorVersion: row.validator_version,
      status: row.status,
      safetyStatus: row.safety_status,
      epubVersion: row.epub_version,
      updatedAt: row.updated_at,
    })),
  });
}
