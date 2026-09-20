/**
 * Schema contract: every audit entity type the Worker writes must be accepted
 * by the `audit_log.entity_type` CHECK constraint.
 *
 * Applies the real migration set to an in-memory SQLite database and inserts
 * one row per type in AUDIT_ENTITY_TYPES. A mismatch (a type used by route
 * code but absent from the CHECK) makes audit writes fail at runtime — with
 * `executionCtx` they become unhandled rejections and the trail is silently
 * lost. This test is the drift guard between the two.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { AUDIT_ENTITY_TYPES } from '../audit';

const MIGRATIONS_DIR = resolve(import.meta.dirname, '../../../../packages/schema/migrations');

let db: DatabaseSync;

beforeAll(() => {
  db = new DatabaseSync(':memory:');
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
  expect(files.length).toBeGreaterThan(0);
  for (const file of files) {
    db.exec(readFileSync(resolve(MIGRATIONS_DIR, file), 'utf8'));
  }
});

afterAll(() => {
  db?.close();
});

function insertAudit(entityType: string): void {
  db.prepare(
    `INSERT INTO audit_log (id, actor_email, entity_type, entity_id, action, payload_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(randomUUID(), 'admin@example.com', entityType, 'entity-1', 'test', null);
}

describe('audit_log entity_type constraint', () => {
  it('accepts every entity type the Worker writes', () => {
    for (const entityType of AUDIT_ENTITY_TYPES) {
      expect(() => insertAudit(entityType), `${entityType} rejected by CHECK`).not.toThrow();
    }
  });

  it('rejects an unknown entity type', () => {
    expect(() => insertAudit('not-a-real-entity')).toThrow(/CHECK constraint/);
  });
});
