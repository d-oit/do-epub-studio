export interface Env extends CloudflareEnv {
  TURSO_AUTH_TOKEN: string;
  SESSION_SIGNING_SECRET: string;
  INVITE_TOKEN_SECRET: string;
}

export type JsonRow = Record<string, string | number | null | undefined>;
