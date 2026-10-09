/**
 * A8/GOAP-305 — telemetry retention that actually runs.
 *
 * Real SQLite with every numbered migration applied, so the assertions are
 * about rows rather than about SQL text: the audit's finding was that the
 * documented 90-day window had no executable owner, and the only way to show it
 * now has one is to delete rows and count what remains.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { Env } from '../lib/env';
import {
  TELEMETRY_RETENTION_BATCH_SIZE,
  deleteEventsOlderThan,
  retentionCutoff,
  runTelemetryRetention,
} from '../lib/telemetry-retention';

const MIGRATIONS_DIR = resolve(import.meta.dirname, '../../../../packages/schema/migrations');

type SqlValue = string | number | null;
type SqlRow = Record<string, SqlValue>;

function makeSqliteEnv(database: DatabaseSync): Env {
  const prepare = (sql: string) => {
    const statement = database.prepare(sql);
    return {
      bind: (...args: SqlValue[]) => ({
        all: () => {
          try {
            const results = statement.all(...args) as SqlRow[];
            return { results };
          } catch {
            const result = statement.run(...args);
            return { results: [], meta: { changes: Number(result.changes) } };
          }
        },
        run: () => {
          const result = statement.run(...args);
          return { meta: { changes: Number(result.changes) } };
        },
      }),
    };
  };
  return { DB: { prepare } } as unknown as Env;
}

let db: DatabaseSync;
let env: Env;

function applyMigrations(database: DatabaseSync): void {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort();
  for (const file of files) {
    database.exec(readFileSync(resolve(MIGRATIONS_DIR, file), 'utf8'));
  }
}

function insertEvent(receivedAt: string, event = 'test.event'): void {
  db.prepare(
    `INSERT INTO telemetry_events (id, level, event, received_at) VALUES (?, 'info', ?, ?)`,
  ).run(randomUUID(), event, receivedAt);
}

function countEvents(): number {
  const row = db.prepare('SELECT COUNT(*) AS cnt FROM telemetry_events').get() as { cnt: number };
  return Number(row.cnt);
}

/** `datetime('now')` shape, which is what the table stores by default. */
function sqliteTimestamp(msAgo: number): string {
  return new Date(Date.now() - msAgo).toISOString().replace('T', ' ').slice(0, 19);
}

const DAY_MS = 86_400_000;

describe('telemetry retention (A8/GOAP-305)', () => {
  beforeAll(() => {
    db = new DatabaseSync(':memory:');
    applyMigrations(db);
    env = makeSqliteEnv(db);
  });

  afterEach(() => {
    db.exec('DELETE FROM telemetry_events');
  });

  it('deletes rows older than the window and preserves newer rows', async () => {
    const now = Date.now();
    insertEvent(sqliteTimestamp(120 * DAY_MS), 'old.a');
    insertEvent(sqliteTimestamp(100 * DAY_MS), 'old.b');
    insertEvent(sqliteTimestamp(89 * DAY_MS), 'recent.a');
    insertEvent(sqliteTimestamp(0), 'recent.b');
    expect(countEvents()).toBe(4);

    const result = await deleteEventsOlderThan(env, 90, now);

    expect(result.deleted).toBe(2);
    expect(result.batches).toBe(1); // one pass removes all old rows, then the loop exits
    expect(countEvents()).toBe(2);
    const remaining = db
      .prepare('SELECT event FROM telemetry_events ORDER BY event')
      .all() as Array<{
      event: string;
    }>;
    expect(remaining.map((r) => r.event)).toEqual(['recent.a', 'recent.b']);
  });

  it('respects the exact cutoff boundary', async () => {
    const now = Date.now();
    const cutoff = retentionCutoff(90, now);
    // One second either side of the boundary: the cutoff row itself is newer.
    insertEvent(
      new Date(new Date(cutoff).getTime() - 1_000).toISOString().slice(0, 19).replace('T', ' '),
    );
    insertEvent(
      new Date(new Date(cutoff).getTime() + 60_000).toISOString().slice(0, 19).replace('T', ' '),
    );

    const result = await deleteEventsOlderThan(env, 90, now);

    expect(result.deleted).toBe(1);
    expect(countEvents()).toBe(1);
    const kept = db.prepare('SELECT received_at FROM telemetry_events').get() as {
      received_at: string;
    };
    expect(kept.received_at > cutoff.slice(0, 19).replace('T', ' ')).toBe(true);
  });

  it('drains more rows than one batch and is idempotent on a second run', async () => {
    const now = Date.now();
    const oversized = TELEMETRY_RETENTION_BATCH_SIZE * 2 + 7;
    for (let i = 0; i < oversized; i += 1) {
      insertEvent(sqliteTimestamp(120 * DAY_MS), `old.${i}`);
    }
    insertEvent(sqliteTimestamp(0), 'recent');
    expect(countEvents()).toBe(oversized + 1);

    const first = await deleteEventsOlderThan(env, 90, now);
    expect(first.deleted).toBe(oversized);
    expect(first.batches).toBe(3); // 500 + 500 + 7 (< batch size ends the loop)
    expect(first.exhausted).toBe(false);
    expect(countEvents()).toBe(1);

    const second = await deleteEventsOlderThan(env, 90, now);
    expect(second.deleted).toBe(0);
    expect(second.batches).toBe(1);
  });

  it('returns without querying when the binding is absent', async () => {
    const result = await deleteEventsOlderThan({} as Env, 90, Date.now());
    expect(result).toEqual({
      deleted: 0,
      batches: 0,
      cutoff: expect.any(String),
      exhausted: false,
    });
  });

  it('rejects a non-positive window instead of deleting everything', async () => {
    await expect(deleteEventsOlderThan(env, 0, Date.now())).rejects.toBeInstanceOf(RangeError);
    await expect(deleteEventsOlderThan(env, Number.NaN, Date.now())).rejects.toBeInstanceOf(
      RangeError,
    );
  });

  it('logs a failed cleanup instead of throwing out of the scheduled event', async () => {
    // The runbook promises a retention failure never affects anything but the
    // logs — a cron that throws would surface as a failed scheduled event.
    const brokenEnv = {
      DB: {
        prepare: () => ({
          bind: () => ({
            run: () => {
              throw new Error('D1 unavailable');
            },
          }),
        }),
      },
    } as unknown as Env;
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await expect(runTelemetryRetention(brokenEnv, Date.now())).resolves.toBeUndefined();
      const logged = errorSpy.mock.calls.map((call) => JSON.stringify(call)).join('\n');
      expect(logged).toContain('telemetry.retention.failed');
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('keeps the deployed cron wired to this owner', () => {
    // The audit's gap was config-shaped as much as code-shaped: the handler
    // existed in a runbook snippet while `wrangler.jsonc` had no trigger. This
    // asserts the deployable configuration, not a string in the source.
    const config = readFileSync(resolve(import.meta.dirname, '../../wrangler.jsonc'), 'utf8');
    const crons = config.match(/"crons"\s*:\s*\[([^\]]*)\]/)?.[1] ?? '';
    expect(crons).toContain('0 3 * * 0');
  });
});
