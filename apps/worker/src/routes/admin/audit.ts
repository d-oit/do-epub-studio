import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { Env } from '../../lib/env';
import { queryAll } from '../../db/client';
import { logAudit } from '../../audit';
import { adminAuth } from '../../middleware/auth';
import { AuditQuerySchema } from '@do-epub-studio/shared';

export const auditRouter = new Hono<{ Bindings: Env; Variables: { adminUser: { email: string; id: string; role: string } } }>();

auditRouter.get('/audit', adminAuth, zValidator('query', AuditQuerySchema), async (c) => {
  const { entityType, entityId, limit, offset, from, to } = c.req.valid('query');

  await logAudit(c.env, {
    entityType: entityType ?? 'user', // default to user for query logging if undefined
    entityId: entityId ?? '',
    action: 'query',
  }, c.executionCtx);

  const conditions: string[] = [];
  const args: (string | number)[] = [];

  if (entityType) {
    conditions.push('entity_type = ?');
    args.push(entityType);
  }
  if (entityId) {
    conditions.push('entity_id = ?');
    args.push(entityId);
  }
  if (from) {
    conditions.push('created_at >= ?');
    args.push(from);
  }
  if (to) {
    conditions.push('created_at <= ?');
    args.push(to);
  }

  const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await queryAll<{ cnt: number }>(
    c.env,
    `SELECT COUNT(*) as cnt FROM audit_log${whereClause}`,
    args,
  );
  const total = countResult[0]?.cnt ?? 0;

  const rows = await queryAll(
    c.env,
    `SELECT * FROM audit_log${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...args, limit, offset],
  );

  return c.json({
    ok: true,
    data: {
      entries: rows.map((row) => ({
        id: row.id,
        actorEmail: row.actor_email,
        entityType: row.entity_type,
        entityId: row.entity_id,
        action: row.action,
        payload: row.payload_json ? (JSON.parse(row.payload_json as string) as Record<string, unknown>) : null,
        createdAt: row.created_at,
      })),
      total,
    },
  });
});
