export interface Env extends CloudflareEnv {
  TURSO_AUTH_TOKEN: string;
  SESSION_SIGNING_SECRET: string;
  INVITE_TOKEN_SECRET: string;
  EMAIL_SEND?: { send(opts: { from: string; to: string; subject: string; text?: string; html?: string }): Promise<unknown> };
  EMAIL_SENDER?: string;
}

export type JsonRow = Record<string, string | number | null | undefined>;
