import type { Env, JsonRow } from '../lib/env';

export async function queryFirst<T extends JsonRow>(
  env: Env,
  sql: string,
  args?: (string | number | null)[]
): Promise<T | null> {
  const result = await query(env, sql, args);
  return (result.rows[0] as T) ?? null;
}

export async function queryAll<T extends JsonRow>(
  env: Env,
  sql: string,
  args?: (string | number | null)[]
): Promise<T[]> {
  const result = await query(env, sql, args);
  return result.rows as T[];
}

export async function execute(
  env: Env,
  sql: string,
  args?: (string | number | null)[]
): Promise<{ rows: JsonRow[] }> {
  return query(env, sql, args);
}

async function query(
  env: Env,
  sql: string,
  args?: (string | number | null)[]
): Promise<{ rows: JsonRow[] }> {
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

  const data = await response.json();
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
