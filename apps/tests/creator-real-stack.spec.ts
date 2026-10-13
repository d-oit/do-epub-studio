import { expect, test, request as playwrightRequest } from '@playwright/test';

// GOAP-1003 E3 follow-up: real-stack authorization journey.
//
// Runs against a locally running worker (`wrangler dev`) whose local D1 was
// seeded by `scripts/seed-creator-journey.mjs`. It proves, through the real
// Worker and database, that:
//   * an assigned creator can list the book's private feedback,
//   * the submitter who authored a private row can read their own feedback
//     but cannot reach the creator review surface,
//   * an outsider with a reader session but no assignment is denied the
//     creator surface and sees no feedback rows.
//
// Skipped unless CREATOR_JOURNEY_WORKER_URL is set, so the default mock suite
// does not depend on a running worker.

const WORKER_URL = process.env.CREATOR_JOURNEY_WORKER_URL;
const BOOK_ID = 'journey-book-1';
const FEEDBACK_ID = 'journey-feedback-private-1';

const CREATOR = 'journey-creator-session-token';
const SUBMITTER = 'journey-submitter-session-token';
const OUTSIDER = 'journey-outsider-session-token';

test.describe('E3 real-stack: creator feedback authorization', () => {
  test.skip(!WORKER_URL, 'set CREATOR_JOURNEY_WORKER_URL to a seeded local worker');

  test('assigned creator reviews the private feedback', async () => {
    const api = await playwrightRequest.newContext({
      baseURL: WORKER_URL,
      extraHTTPHeaders: { Authorization: `Bearer ${CREATOR}` },
    });
    const res = await api.get(`/api/creator/books/${BOOK_ID}/feedback`);
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { data: Array<{ id: string }> };
    expect(body.data.map((row) => row.id)).toContain(FEEDBACK_ID);
    await api.dispose();
  });

  test('submitter reads only their own feedback, not the creator surface', async () => {
    const api = await playwrightRequest.newContext({
      baseURL: WORKER_URL,
      extraHTTPHeaders: { Authorization: `Bearer ${SUBMITTER}` },
    });
    const creatorRes = await api.get(`/api/creator/books/${BOOK_ID}/feedback`);
    expect(creatorRes.status()).toBe(403);

    const ownRes = await api.get(`/api/books/${BOOK_ID}/feedback`);
    expect(ownRes.status()).toBe(200);
    const own = (await ownRes.json()) as { data: Array<{ id: string }> };
    expect(own.data.map((row) => row.id)).toEqual([FEEDBACK_ID]);
    await api.dispose();
  });

  test('outsider with no assignment is denied the creator surface and sees no rows', async () => {
    const api = await playwrightRequest.newContext({
      baseURL: WORKER_URL,
      extraHTTPHeaders: { Authorization: `Bearer ${OUTSIDER}` },
    });
    const creatorRes = await api.get(`/api/creator/books/${BOOK_ID}/feedback`);
    expect(creatorRes.status()).toBe(403);

    const ownRes = await api.get(`/api/books/${BOOK_ID}/feedback`);
    expect(ownRes.status()).toBe(200);
    const own = (await ownRes.json()) as { data: unknown[] };
    expect(own.data).toHaveLength(0);
    await api.dispose();
  });
});
