import type { Env } from '../lib/env';

type EntityType = 'book' | 'grant' | 'session' | 'comment' | 'user' | 'bookmark' | 'highlight';

interface AuditEntry {
  entityType: EntityType;
  entityId: string;
  action: string;
  actorEmail?: string;
  payload?: Record<string, unknown>;
}

export async function logAudit(env: Env, entry: AuditEntry): Promise<void> {
  const id = crypto.randomUUID();
  const payloadJson = entry.payload ? JSON.stringify(entry.payload) : null;

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
  const rows = await queryAll(env, sql, args);

  return rows.map(row => ({
    id: row.id as string,
    actorEmail: row.actor_email as string | null,
    entityType: row.entity_type as string,
    entityId: row.entity_id as string,
    action: row.action as string,
    payload: row.payload_json ? JSON.parse(row.payload_json as string) : null,
    createdAt: row.created_at as string,
  }));
}
