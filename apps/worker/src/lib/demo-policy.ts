/** Shared runtime gate for dedicated demo endpoints and published demo credentials. */
interface DemoEnvironment {
  ENVIRONMENT?: string;
  CF_PAGES?: string;
  TURSO_DATABASE_URL?: string;
  DEMO_ACCOUNTS_PROD_ALLOWLIST?: string;
  DEMO_LOGIN_ENABLED?: string;
}

export const DEMO_READER_EMAIL = 'demo.reader@example.local';
export const DEMO_ADMIN_EMAIL = 'demo.admin@example.local';

export function isReservedDemoEmail(email: string): boolean {
  const normalizedEmail = email.toLowerCase();
  return normalizedEmail === DEMO_READER_EMAIL || normalizedEmail === DEMO_ADMIN_EMAIL;
}

export function isDemoLoginEnabled(env: DemoEnvironment): boolean {
  if (env.DEMO_LOGIN_ENABLED !== '1') return false;
  if (String(env.ENVIRONMENT || '').toLowerCase() === 'production') return false;
  if (env.CF_PAGES === '1' && !env.DEMO_ACCOUNTS_PROD_ALLOWLIST) return false;
  return !String(env.TURSO_DATABASE_URL || '')
    .toLowerCase()
    .includes('production');
}

export function canUseDemoCredentials(
  env: DemoEnvironment,
  email: string,
  createdByDemo?: number,
): boolean {
  const isDemo = createdByDemo === 1 || isReservedDemoEmail(email);
  return !isDemo || isDemoLoginEnabled(env);
}
