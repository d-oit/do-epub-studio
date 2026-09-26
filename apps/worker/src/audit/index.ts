import type { Env } from '../lib/env';
import { execute } from '../db/client';
import { logAppError } from '../lib/observability';
import { EntityTypeSchema } from '@do-epub-studio/schema';

/**
 * Entity types written to `audit_log`, derived from the canonical
 * `EntityTypeSchema`. `audit_log.entity_type`'s CHECK constraint must accept
 * every value here — `audit-entity-types.test.ts` applies the real migrations
 * to SQLite and proves it, so a new value needs a migration too.
 */
export const AUDIT_ENTITY_TYPES = EntityTypeSchema.options;

/** Union of every entity type accepted by `audit_log.entity_type`. */
export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];

interface AuditEntry {
  entityType: AuditEntityType;
  entityId: string;
  action: string;
  actorEmail?: string;
  payload?: Record<string, unknown>;
}

const MAX_SANITIZE_DEPTH = 10;
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const SENSITIVE_KEYS = new Set([
  'token',
  'password',
  'secret',
  'magiclink',
  'signature',
  'sessiontoken',
  'passwordhash',
  'key',
  'apikey',
  'auth',
  'credential',
]);

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

    let sanitizedValue: unknown;
    const normalizedKey = key.toLowerCase().replace(/[^a-z]/g, '');

    // Redact sensitive values
    if (SENSITIVE_KEYS.has(normalizedKey)) {
      sanitizedValue = '[REDACTED]';
    } else if (value === null || value === undefined) {
      sanitizedValue = value;
    } else if (typeof value === 'string') {
      sanitizedValue = value.length > 10000 ? value.slice(0, 10000) + '...' : value;
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      sanitizedValue = value;
    } else if (Array.isArray(value)) {
      const sanitizedArray: unknown[] = [];
      for (const item of value.slice(0, 100)) {
        if (typeof item === 'object' && item !== null) {
          sanitizedArray.push(sanitizeAuditPayload(item as Record<string, unknown>, depth + 1));
        } else if (typeof item === 'string' && item.length > 10000) {
          sanitizedArray.push(item.slice(0, 10000) + '...');
        } else {
          sanitizedArray.push(item);
        }
      }
      sanitizedValue = sanitizedArray;
    } else if (typeof value === 'object') {
      sanitizedValue = sanitizeAuditPayload(value as Record<string, unknown>, depth + 1);
    } else {
      const str = typeof value === 'string' ? value : JSON.stringify(value);
      sanitizedValue = str.slice(0, 10000);
    }

    Object.defineProperty(result, key, {
      value: sanitizedValue,
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }
  return result;
}

export async function logAudit(
  env: Env,
  entry: AuditEntry,
  ctx?: { waitUntil: (promise: Promise<unknown>) => void },
): Promise<void> {
  const promise = (async () => {
    const payloadJson = entry.payload ? JSON.stringify(sanitizeAuditPayload(entry.payload)) : null;

    try {
      await execute(
        env,
        `INSERT INTO audit_log (id, actor_email, entity_type, entity_id, action, payload_json)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          crypto.randomUUID(),
          entry.actorEmail ?? null,
          entry.entityType,
          entry.entityId,
          entry.action,
          payloadJson,
        ],
      );
    } catch (error) {
      // D1 reports a CHECK rejection without naming the offending value, so
      // record the entity type and action that the schema refused. The error is
      // re-thrown: a dropped audit entry must stay visible, never silent.
      logAppError('audit.insert_failed', error, {
        entityType: entry.entityType,
        entityId: entry.entityId,
        action: entry.action,
      });
      throw error;
    }
  })();

  if (ctx) {
    ctx.waitUntil(promise);
  } else {
    await promise;
  }
}
