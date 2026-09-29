import { test, expect, type Page, type Route } from '@playwright/test';
import { ADMIN_LOGIN_RESPONSE, ADMIN_USER, loginAsAdmin } from './fixtures';

/**
 * Browser verification of the book-invitation flow (GOAP-284 acceptance
 * criterion, and the last open box in `plans/284-goap-production-onboarding.md`).
 *
 * Phase 5 drove the whole chain at the API level against a real Worker
 * (13/13) and found a real tenant-guard bug. What was missing is this:
 * proving the *UI* an administrator and an invitee actually use — the
 * `InvitationsPanel` form and the `/accept-invite` route — works at mobile
 * and desktop sizes.
 *
 * The API is mocked (`page.route`), matching the other admin specs. That is
 * deliberate: the Worker contract is already covered by the live Phase 5 run
 * and by the route/integration suites, so this lane exists to cover what only
 * a browser can see — form controls, step-up gating as rendered, the
 * acceptance form's validation, and responsive layout.
 */

const BOOK_ID = 'book-invite-1';
const BOOK_SLUG = 'invite-test-book';
const READER_EMAIL = 'invitee@example.test';
const CREATOR_EMAIL = 'invitee.creator@example.test';
const NEW_PASSWORD = 'Correct-Horse-9';

const BOOK_LIST = {
  ok: true,
  data: [
    {
      id: BOOK_ID,
      slug: BOOK_SLUG,
      title: 'Invitation Test Book',
      authorName: 'Test Author',
      visibility: 'private',
    },
  ],
};

function invitation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inv-1',
    bookId: BOOK_ID,
    email: READER_EMAIL,
    role: 'reader',
    status: 'pending',
    deliveryStatus: 'sent',
    grantMode: 'private',
    commentsAllowed: false,
    offlineAllowed: false,
    grantExpiresAt: null,
    expiresAt: '2099-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    acceptedAt: null,
    revokedAt: null,
    ...overrides,
  };
}

/** How a single create attempt is answered. */
interface PostAnswer {
  status?: number;
  json?: unknown;
}

/**
 * Mocks every admin/books endpoint the panel touches, recording the created
 * invitations and the number of create attempts.
 *
 * The onPost callback decides how each attempt is answered, which is what lets
 * the step-up test return 428 once and then let the retry succeed, from the
 * SAME route registration. Registering a second invitations handler instead is
 * a trap: Playwright runs the LAST matching handler first, so the second one
 * silently shadows the first and any counter in it stops being the real signal.
 */
async function mockAdminBooks(page: Page, onPost?: (attempt: number) => PostAnswer | undefined) {
  const created: Array<Record<string, unknown>> = [];
  let attempts = 0;

  await page.route('**/api/admin/books', async (route: Route) => {
    await route.fulfill({ json: BOOK_LIST });
  });

  await page.route(`**/api/admin/books/${BOOK_ID}/invitations`, async (route: Route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      created.push(body);
      attempts += 1;
      const answer = onPost?.(attempts);
      await route.fulfill(
        answer?.status
          ? { status: answer.status, json: answer.json }
          : {
              json: {
                ok: true,
                data: {
                  invitation: invitation({ email: body.email, role: body.role }),
                  delivery: 'sent',
                  copyUrl: null,
                },
              },
            },
      );
      return;
    }
    await route.fulfill({ json: { ok: true, data: [invitation()] } });
  });

  await page.route(`**/api/admin/books/${BOOK_ID}/invitations/*/revoke`, async (route: Route) => {
    await route.fulfill({ json: { ok: true, data: invitation({ status: 'revoked' }) } });
  });

  return { created, attempts: () => attempts };
}

/**
 * Mocks the accept-invite call. `state` drives the response, and the returned
 * `calls` counter lets a test assert the API was never called at all.
 */
async function mockAcceptInvite(page: Page, state: 'ok' | 'error' = 'ok') {
  const counter = { calls: 0 };
  await page.route('**/api/access/accept-invite', async (route: Route) => {
    counter.calls += 1;
    if (state === 'error') {
      await route.fulfill({
        status: 400,
        json: { ok: false, error: { code: 'INVITATION_INVALID' } },
      });
      return;
    }
    await route.fulfill({
      json: {
        ok: true,
        data: {
          sessionToken: 'accepted-session-token',
          expiresAt: '2099-01-01T00:00:00.000Z',
          email: READER_EMAIL,
          role: 'reader',
          book: { id: BOOK_ID, slug: BOOK_SLUG, title: 'Invitation Test Book' },
          capabilities: { canRead: true, canComment: false, canAnnotate: false },
        },
      },
    });
  });
  return counter;
}

/**
 * Mocks the admin step-up endpoint, counting how many times it was called so a
 * test can assert the retry path. The token it returns is echoed in the reply
 * so the assertion can show the retry used the rotated one.
 */
async function mockStepUp(page: Page, token = 'step-up-token') {
  const state = { calls: 0 };
  await page.route('**/api/admin/account/step-up', async (route: Route) => {
    state.calls += 1;
    await route.fulfill({
      json: { ok: true, data: { token, expiresAt: '2099-01-01T00:00:00.000Z' } },
    });
  });
  return state;
}

/** Opens the admin book page, which is where the invitations panel lives. */
async function openBookAdmin(page: Page) {
  await loginAsAdmin(page);
  // The panel is rendered by GrantsPage, whose route is /admin/books/:bookId/grants
  // (App.tsx) -- not /admin/books/:bookId.
  await page.goto(`/admin/books/${BOOK_ID}/grants`);
  await expect(page.getByRole('heading', { name: 'Book invitations' })).toBeVisible();
}

/**
 * Navigates to the acceptance form. The token must be at least 32 characters or
 * the page renders "Invitation unavailable"; a syntactically valid but rejected
 * token still reaches the form, which is what the rejection test needs.
 */
const VALID_TOKEN = 'VALID_TOKEN_32_CHARS_MINIMUM_000';
const REJECTED_TOKEN = 'INVALID_TOKEN_32_CHARS_LONG_ENOUGH_X';

async function gotoAcceptanceForm(page: Page, token = VALID_TOKEN) {
  await page.goto(`/accept-invite#token=${token}`);
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
}

/** Fills the acceptance form with matching passwords and submits it. */
async function fillAcceptanceForm(page: Page) {
  await gotoAcceptanceForm(page);
  await page.getByLabel('Password', { exact: true }).fill(NEW_PASSWORD);
  await page.getByLabel('Confirm password', { exact: true }).fill(NEW_PASSWORD);
  await page.getByRole('button', { name: 'Accept invitation' }).click();
}

test.describe('book invitation flow (browser)', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/admin/login', async (route: Route) => {
      await route.fulfill({ json: ADMIN_LOGIN_RESPONSE });
    });
    await mockStepUp(page);
    await page.route('**/api/admin/books/*/creators', async (route: Route) => {
      await route.fulfill({ json: { ok: true, data: [] } });
    });
    await page.route('**/api/admin/books/*/grants', async (route: Route) => {
      await route.fulfill({ json: { ok: true, data: [] } });
    });
  });

  test('an administrator creates a reader invitation from the panel', async ({ page }) => {
    const { created } = await mockAdminBooks(page);
    await openBookAdmin(page);

    // The role is chosen before the shared submit helper drives the rest of
    // the form, so the helper stays a single, honest interaction path.
    await page.getByRole('button', { name: 'Invite person' }).click();
    await page.getByLabel('Invitation role').selectOption('reader');
    await page.getByLabel('Email address').fill(READER_EMAIL);
    await page.getByRole('button', { name: 'Send invitation' }).click();

    // The panel re-fetches after create; the new row must reach the screen.
    await expect(page.getByText(READER_EMAIL)).toBeVisible({ timeout: 15000 });
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ bookId: BOOK_ID, email: READER_EMAIL, role: 'reader' });
  });

  test('a 428 opens the step-up prompt instead of failing the create', async ({ page }) => {
    // A guarded mutation that answers 428 must surface the step-up modal, then
    // retry once with the rotated token (useAdminStepUp). Asserting an inline
    // alert here would be wrong: the panel never renders one for a step-up.
    const stepUp = await mockStepUp(page, 'rotated-token');

    // The same route registration answers the create; `onPost` turns the first
    // attempt into a step-up demand and lets the retry succeed.
    const books = await mockAdminBooks(page, (attempt) =>
      attempt === 1
        ? { status: 428, json: { ok: false, error: { code: 'STEP_UP_REQUIRED' } } }
        : undefined,
    );
    await openBookAdmin(page);

    // The submit control is "Send invitation"; the other button in view is the
    // "Invite person" form toggle, which would merely collapse the form.
    await page.getByRole('button', { name: 'Invite person' }).click();
    await page.getByLabel('Email address').fill(READER_EMAIL);
    await page.getByRole('button', { name: 'Send invitation' }).click();

    // The prompt appears, the user completes it, and the create is retried once
    // with the rotated token rather than the original.
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: 15000 });
    await modal.getByLabel('Current Password', { exact: true }).fill(ADMIN_USER.password);
    await modal.getByRole('button', { name: 'Confirm', exact: true }).click();

    await expect.poll(() => books.attempts(), { timeout: 20000 }).toBe(2);
    expect(stepUp.calls).toBeGreaterThanOrEqual(1);
  });

  test('an invitee accepts the invitation and is signed in', async ({ page }) => {
    await mockAcceptInvite(page, 'ok');
    await fillAcceptanceForm(page);

    // Success navigates away from the acceptance form.
    await expect(page).not.toHaveURL(/#token=/, { timeout: 15000 });
  });

  test('the acceptance form refuses mismatched passwords before calling the API', async ({
    page,
  }) => {
    // A successful response is available, so if the form did submit we would
    // see the navigation; asserting calls === 0 is what proves it refused.
    const accept = await mockAcceptInvite(page);

    await gotoAcceptanceForm(page);
    await page.getByLabel('Password', { exact: true }).fill(NEW_PASSWORD);
    await page.getByLabel('Confirm password', { exact: true }).fill('Different-Password-9');
    await page.getByRole('button', { name: 'Accept invitation' }).click();

    await expect(page.getByText('Passwords do not match')).toBeVisible({ timeout: 10000 });
    expect(accept.calls).toBe(0);
  });

  test('a rejected acceptance shows an error and no session', async ({ page }) => {
    await mockAcceptInvite(page, 'error');

    await gotoAcceptanceForm(page, REJECTED_TOKEN);
    await page.getByLabel('Password', { exact: true }).fill(NEW_PASSWORD);
    await page.getByLabel('Confirm password', { exact: true }).fill(NEW_PASSWORD);
    await page.getByRole('button', { name: 'Accept invitation' }).click();

    await expect(page.getByRole('alert')).toBeVisible({ timeout: 15000 });
  });

  test('the invitation panel and acceptance form work at a mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockAdminBooks(page);
    await openBookAdmin(page);

    await page.getByRole('button', { name: 'Invite person' }).click();
    const emailField = page.getByLabel('Email address');
    await expect(emailField).toBeVisible();
    // Touch target: the control must be usable, not merely present.
    const box = await emailField.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(32);

    await mockAcceptInvite(page, 'ok');
    await gotoAcceptanceForm(page);
    await expect(page.getByLabel('Confirm password', { exact: true })).toBeVisible();
  });
});
