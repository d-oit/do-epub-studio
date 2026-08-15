export interface Env extends CloudflareEnv {
  TURSO_AUTH_TOKEN: string;
  SESSION_SIGNING_SECRET: string;
  INVITE_TOKEN_SECRET: string;
  EMAIL_SEND?: { send(opts: { from: string; to: string; subject: string; text?: string; html?: string }): Promise<unknown> };
  EMAIL_SENDER?: string;
  SENTRY_DSN?: string;
  ENVIRONMENT?: string;
  DEMO_LOGIN_ENABLED?: string;
  DEMO_BOOK_SLUG?: string;
  CF_PAGES?: string;
  DEMO_ACCOUNTS_PROD_ALLOWLIST?: string;
  WEBAUTHN_RP_ID: string;
  WEBAUTHN_RP_NAME?: string;
  WEBAUTHN_ORIGIN: string;
}

export type JsonRow = Record<string, string | number | null | undefined>;
