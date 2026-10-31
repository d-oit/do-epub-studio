import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  makeEnv,
  makePassThroughContext,
  mockQueryAll,
  mockQueryFirst,
  mockExecute,
  mockRequireAdminAuth,
  mockStepUpAssured,
} from './fixtures';
import { app } from '../app';

describe('Admin Books Validation Routes', () => {
  const env = makeEnv();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockAdminAuth = () =>
    mockRequireAdminAuth.mockResolvedValue({
      ok: true,
      context: { userId: 'admin-1', email: 'admin@example.com', globalRole: 'admin' },
    });

  it('GET /api/admin/books/:id/validation-reports lists revision reports', async () => {
    mockAdminAuth();
    mockQueryAll.mockResolvedValue([
      {
        id: 'rep-1',
        revision_id: 'rev-1',
        bytes_sha256: 'a'.repeat(64),
        validator_version: '5.4.0',
        status: 'completed',
        safety_status: 'accepted',
        epub_version: '3.0',
        findings_json: '[]',
        accessibility_json: '{}',
        failure_code: null,
        updated_at: '2026-10-31T00:00:00.000Z',
      },
    ]);

    const res = await app.fetch(
      new Request('http://localhost/api/admin/books/book-1/validation-reports', {
        headers: { Authorization: 'Bearer admin-token' },
      }),
      env,
      makePassThroughContext(),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      ok: true,
      data: [expect.objectContaining({ revisionId: 'rev-1' })],
    });
  });

  it('GET /api/admin/books/:id/revisions/:revisionId/validation gets detailed report with groups', async () => {
    mockAdminAuth();
    mockQueryFirst
      .mockResolvedValueOnce({
        id: 'rep-1',
        revision_id: 'rev-1',
        bytes_sha256: 'a'.repeat(64),
        validator_version: '5.4.0',
        status: 'completed',
        safety_status: 'accepted',
        epub_version: '3.0',
        findings_json: JSON.stringify([
          {
            severity: 'error',
            code: 'RSC-005',
            location: null,
            path: null,
            message: 'Invalid reference',
          },
        ]),
        accessibility_json: JSON.stringify({
          metadata: [],
          advisories: [],
          manualReviewRequired: true,
          certification: 'not-certified',
        }),
        failure_code: null,
        updated_at: '2026-10-31T00:00:00.000Z',
      })
      .mockResolvedValueOnce({
        state_json: JSON.stringify({ status: 'in_progress', notes: 'Working on RSC-005' }),
      });

    const res = await app.fetch(
      new Request('http://localhost/api/admin/books/book-1/revisions/rev-1/validation', {
        headers: { Authorization: 'Bearer admin-token' },
      }),
      env,
      makePassThroughContext(),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      ok: true,
      data: {
        groups: {
          errors: [expect.objectContaining({ code: 'RSC-005' })],
        },
      },
    });
  });

  it('GET /api/admin/books/:id/revisions/:revisionId/validation.json downloads report JSON', async () => {
    mockAdminAuth();
    mockQueryFirst.mockResolvedValue({
      id: 'rep-1',
      revision_id: 'rev-1',
      bytes_sha256: 'a'.repeat(64),
      validator_version: '5.4.0',
      status: 'completed',
      safety_status: 'accepted',
      epub_version: '3.0',
      findings_json: '[]',
      accessibility_json: '{}',
      failure_code: null,
      updated_at: '2026-10-31T00:00:00.000Z',
    });

    const res = await app.fetch(
      new Request('http://localhost/api/admin/books/book-1/revisions/rev-1/validation.json', {
        headers: { Authorization: 'Bearer admin-token' },
      }),
      env,
      makePassThroughContext(),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toContain('attachment');
  });

  it('POST /api/admin/books/:id/revisions/:revisionId/validation/retry resets to pending', async () => {
    mockAdminAuth();
    mockStepUpAssured();
    mockQueryFirst.mockResolvedValue({
      id: 'rep-1',
      revision_id: 'rev-1',
      bytes_sha256: 'a'.repeat(64),
      validator_version: '5.4.0',
      status: 'failed',
      safety_status: 'pending',
      epub_version: null,
      findings_json: '[]',
      accessibility_json: '{}',
      failure_code: 'RUNNER_UNAVAILABLE',
      updated_at: '2026-10-31T00:00:00.000Z',
    });
    mockExecute.mockResolvedValue({ rows: [] });

    const res = await app.fetch(
      new Request('http://localhost/api/admin/books/book-1/revisions/rev-1/validation/retry', {
        method: 'POST',
        headers: { Authorization: 'Bearer admin-token' },
      }),
      env,
      makePassThroughContext(),
    );

    expect(res.status).toBe(202);
    expect(mockExecute).toHaveBeenCalled();
  });

  it('PATCH /api/admin/books/:id/revisions/:revisionId/accessibility-remediation updates remediation', async () => {
    mockAdminAuth();
    mockStepUpAssured();
    mockQueryFirst.mockResolvedValue({
      id: 'rep-1',
      revision_id: 'rev-1',
      bytes_sha256: 'a'.repeat(64),
      validator_version: '5.4.0',
      status: 'completed',
      safety_status: 'accepted',
      epub_version: '3.0',
      findings_json: '[]',
      accessibility_json: '{}',
      failure_code: null,
      updated_at: '2026-10-31T00:00:00.000Z',
    });
    mockExecute.mockResolvedValue({ rows: [] });

    const res = await app.fetch(
      new Request(
        'http://localhost/api/admin/books/book-1/revisions/rev-1/accessibility-remediation',
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer admin-token',
          },
          body: JSON.stringify({
            status: 'remediated',
            notes: 'Remediated headings and tables',
          }),
        },
      ),
      env,
      makePassThroughContext(),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      ok: true,
      data: { remediation: { status: 'remediated' } },
    });
  });
});
