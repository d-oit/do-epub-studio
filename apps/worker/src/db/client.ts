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
  const stmt = env.DB.prepare(sql).bind(...(args ?? []));
  const result = await stmt.all<T>();
  return { rows: result.results ?? [] };
}

export async function transaction(
  env: Env,
  statements: { sql: string; args?: (string | number | null)[] }[]
): Promise<void> {
  const stmts = statements.map(s =>
    env.DB.prepare(s.sql).bind(...(s.args ?? []))
  );
  await env.DB.batch(stmts);
}
