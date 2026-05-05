import type { Env, JsonRow } from '../lib/env';

export interface QueryResult<T extends JsonRow = JsonRow> {
  rows: T[];
}

export async function queryFirst<T extends JsonRow>(
  env: Env,
  sql: string,
  args?: (string | number | null)[]
): Promise<T | null> {
  const result = await query<T>(env, sql, args);
  return result.rows[0] ?? null;
}

export async function queryAll<T extends JsonRow>(
  env: Env,
  sql: string,
  args?: (string | number | null)[]
): Promise<T[]> {
  const result = await query<T>(env, sql, args);
  return result.rows;
}

export async function execute(
  env: Env,
  sql: string,
  args?: (string | number | null)[]
): Promise<QueryResult> {
  return query(env, sql, args);
}

async function query<T extends JsonRow = JsonRow>(
  env: Env,
  sql: string,
  args?: (string | number | null)[]
): Promise<QueryResult<T>> {
  const response = await fetch(env.TURSO_DATABASE_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.TURSO_AUTH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      statements: [{ sql, args: args ?? [] }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Database query failed: ${response.statusText}`);
  }

  const data = (await response.json()) as { rows?: T[] };
  return { rows: data.rows ?? [] };
}

export async function transaction(
  env: Env,
  statements: { sql: string; args?: (string | number | null)[] }[]
): Promise<void> {
  const response = await fetch(env.TURSO_DATABASE_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.TURSO_AUTH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      statements: statements.map(s => ({ sql: s.sql, args: s.args ?? [] })),
    }),
  });

  if (!response.ok) {
    throw new Error(`Database transaction failed: ${response.statusText}`);
  }
}
