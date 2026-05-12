import type { Env, JsonRow } from '../lib/env';

type EntityType = 'book' | 'grant' | 'session' | 'comment' | 'user' | 'bookmark' | 'highlight';

interface AuditEntry {
  entityType: EntityType;
  entityId: string;
  action: string;
  actorEmail?: string;
  payload?: Record<string, unknown>;
}

interface AuditLogRow extends JsonRow {
  id: string;
  actor_email: string | null;
  entity_type: string;
  entity_id: string;
  action: string;
  payload_json: string | null;
  created_at: string;
}

const MAX_SANITIZE_DEPTH = 10;
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export function sanitizeAuditPayload(
  payload: Record<string, unknown>,
  depth = 0,
): Record<string, unknown> {
  if (depth >= MAX_SANITIZE_DEPTH) {
    return { sanitized: true, truncated: true };
  }

  const result = Object.create(null) as Record<string, unknown>;
  for (const [key, value] of Object.entries(payload)) {
    if (FORBIDDEN_KEYS.has(key)) continue;
    if (value === null || value === undefined) {
      result[key] = value;
    } else if (typeof value === 'string') {
      if (value.length > 10000) {
        result[key] = value.slice(0, 10000) + '...';
      } else {
        result[key] = value;
      }
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      result[key] = value;
    } else if (Array.isArray(value)) {
      const sanitized: unknown[] = [];
      for (const item of value.slice(0, 100)) {
        if (typeof item === 'object' && item !== null) {
          sanitized.push(sanitizeAuditPayload(item as Record<string, unknown>, depth + 1));
        } else if (typeof item === 'string' && item.length > 10000) {
          sanitized.push(item.slice(0, 10000) + '...');
        } else {
          sanitized.push(item);
        }
      }
      result[key] = sanitized;
    } else if (typeof value === 'object') {
      result[key] = sanitizeAuditPayload(value as Record<string, unknown>, depth + 1);
    } else {
      const str = typeof value === 'string' ? value : JSON.stringify(value);
      result[key] = str.slice(0, 10000);
    }
  }
  return result;
}

export async function logAudit(env: Env, entry: AuditEntry): Promise<void> {
  const id = crypto.randomUUID();
  const payloadJson = entry.payload
    ? JSON.stringify(sanitizeAuditPayload(entry.payload))
    : null;

  const { execute } = await import('../db/client');
  await execute(
    env,
    `INSERT INTO audit_log (id, actor_email, entity_type, entity_id, action, payload_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, entry.actorEmail ?? null, entry.entityType, entry.entityId, entry.action, payloadJson]
  );
}

export async function getAuditLog(
  env: Env,
  entityType?: EntityType,
  entityId?: string,
  limit = 100
): Promise<Array<{
  id: string;
  actorEmail: string | null;
  entityType: string;
  entityId: string;
  action: string;
  payload: Record<string, unknown> | null;
  createdAt: string;
}>> {
  let sql = 'SELECT * FROM audit_log';
  const args: (string | number)[] = [];
  const conditions: string[] = [];

  if (entityType) {
    conditions.push('entity_type = ?');
    args.push(entityType);
  }

  if (entityId) {
    conditions.push('entity_id = ?');
    args.push(entityId);
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  sql += ' ORDER BY created_at DESC LIMIT ?';
  args.push(limit);

  const { queryAll } = await import('../db/client');
  const rows = await queryAll<AuditLogRow>(env, sql, args);

  return rows.map(row => ({
    id: row.id,
    actorEmail: row.actor_email,
    entityType: row.entity_type,
    entityId: row.entity_id,
    action: row.action,
    payload: row.payload_json ? (JSON.parse(row.payload_json) as Record<string, unknown>) : null,
    createdAt: row.created_at,
  }));
}
