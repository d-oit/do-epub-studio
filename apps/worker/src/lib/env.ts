/**
 * Runtime bindings for the Worker and for the Pages Function that serves the
 * same app (`apps/web/functions/api/[[path]].ts`).
 *
 * `CloudflareEnv` is generated from `apps/worker/wrangler.jsonc`:
 *
 *   pnpm --filter @do-epub-studio/worker exec wrangler types \
 *     --strict-vars=false --env-interface=CloudflareEnv src/worker-configuration.d.ts
 *
 * Generate it with no `.dev.vars` present, otherwise local secrets leak into
 * the committed artifact and the file stops being machine-independent.
 *
 * Two deliberate relaxations of the generated shape:
 *
 * - `EMAIL_SEND` is optional. `wrangler.jsonc` binds it for the Worker, but a
 *   Pages Function cannot bind Email Sending, so the Pages deployment of this
 *   same app has no such binding and falls back to `LoggingEmailTransport`.
 * - The `DEMO_*` / `SENTRY_DSN` / `ENVIRONMENT` vars stay optional because unit
 *   tests and the Pages runtime construct `Env` without them.
 *
 * `SESSION_SIGNING_SECRET` and `INVITE_TOKEN_SECRET` are dashboard secrets that
 * never appear in `wrangler.jsonc`, so they are declared here.
 */

/** Generated keys this type deliberately treats as optional. */
type RelaxedKeys =
  | 'EMAIL_SEND'
  | 'EMAIL_SENDER'
  | 'SENTRY_DSN'
  | 'ENVIRONMENT'
  | 'DEMO_LOGIN_ENABLED'
  | 'DEMO_BOOK_SLUG'
  | 'DEMO_ACCOUNTS_PROD_ALLOWLIST'
  | 'WEBAUTHN_RP_NAME'
  | 'CF_PAGES'
  | 'EPUB_VALIDATION_QUEUE';

export type Env = Omit<CloudflareEnv, RelaxedKeys> & {
  EMAIL_SEND?: SendEmail;
  EMAIL_SENDER?: string;
  SENTRY_DSN?: string;
  ENVIRONMENT?: string;
  DEMO_LOGIN_ENABLED?: string;
  DEMO_BOOK_SLUG?: string;
  DEMO_ACCOUNTS_PROD_ALLOWLIST?: string;
  WEBAUTHN_RP_NAME?: string;
  CF_PAGES?: string;
  SESSION_SIGNING_SECRET: string;
  INVITE_TOKEN_SECRET: string;
  EPUB_VALIDATION_QUEUE?: Queue<{ bookId: string; revisionId: string }>;
  EPUBCHECK_RUNNER_URL?: string;
  EPUBCHECK_RUNNER_TOKEN?: string;
};

export type JsonRow = Record<string, string | number | null | undefined>;
