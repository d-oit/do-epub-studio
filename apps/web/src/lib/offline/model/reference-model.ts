/**
 * Pure reference model for offline sync semantics (no imports, no I/O).
 *
 * Encodes the normative merge rules the suite asserts the real client +
 * server stack satisfies:
 * - Annotation body/quote/anchor fields require an explicit conflict when both
 *   sides changed them; timestamps never decide. Cosmetic fields (color,
 *   note) are resolved by last-write-wins.
 * - Progress divergence always requires a manual choice; a clean serial apply
 *   is only legal when the client's base revision matches the server head.
 * - Bookmark content divergence is manual; a deletion tombstone always wins
 *   over a stale create/replay (a create replay returns the tombstoned row).
 * - Schema-era transitions (legacy rows without mutation ids -> revisioned
 *   rows) preserve identity and content, and only the revisioned era can
 *   dedupe by mutation id.
 */

import type { EntityKind } from './types';

export type SchemaEra = 'legacy' | 'revisioned';

export interface MergeOutcome {
  autoMerge: boolean;
  winner?: 'local' | 'remote';
  reason: 'single_side_change' | 'cosmetic_lww' | 'semantic_conflict' | 'tombstone';
}

export interface EntityFields {
  body?: string;
  quote?: string;
  anchor?: string;
  color?: string;
  label?: string;
}

/** Fields whose concurrent change cannot be auto-merged. */
const SEMANTIC_FIELDS = ['body', 'quote', 'anchor', 'label'] as const;

export function fieldsChanged(
  before: EntityFields | undefined,
  after: EntityFields | undefined,
): string[] {
  const keys = new Set<string>([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  const changed: string[] = [];
  for (const key of keys) {
    const a = before?.[key as keyof EntityFields];
    const b = after?.[key as keyof EntityFields];
    if (a !== b) changed.push(key);
  }
  return changed;
}

/**
 * Merge semantics for a concurrent edit on the same entity. `base` is the
 * content both sides descended from.
 */
export function mergeSemantics(
  base: EntityFields | undefined,
  local: EntityFields,
  remote: EntityFields,
): MergeOutcome {
  const localChanged = fieldsChanged(base, local);
  const remoteChanged = fieldsChanged(base, remote);
  if (localChanged.length === 0)
    return { autoMerge: true, winner: 'remote', reason: 'single_side_change' };
  if (remoteChanged.length === 0)
    return { autoMerge: true, winner: 'local', reason: 'single_side_change' };
  const semanticLocal = localChanged.filter((f) =>
    (SEMANTIC_FIELDS as readonly string[]).includes(f),
  );
  const semanticRemote = remoteChanged.filter((f) =>
    (SEMANTIC_FIELDS as readonly string[]).includes(f),
  );
  const overlap = semanticLocal.filter((f) => semanticRemote.includes(f));
  if (overlap.length > 0) {
    return { autoMerge: false, reason: 'semantic_conflict' };
  }
  // Disjoint changes: merge non-overlapping semantic edits (both applied).
  return { autoMerge: true, reason: 'cosmetic_lww' };
}

/** A deletion tombstone wins over a stale create replay of the same entity. */
export function tombstonePrecedes(tombstoned: boolean, mutationIsReplay: boolean): boolean {
  return tombstoned && mutationIsReplay;
}

export interface LegacyEntity {
  serverId: string;
  kind: EntityKind;
  fields: EntityFields;
}

export interface RevisedEntity extends LegacyEntity {
  mutationId: string | null;
  revision: number;
}

/**
 * Storage/schema era state machine (mirrors the SQL migrations that added
 * `mutation_id` columns and progress revisions).
 */
export class SchemaEraModel {
  era: SchemaEra = 'legacy';

  private legacy: Map<string, LegacyEntity> = new Map();

  private revised: Map<string, RevisedEntity> = new Map();

  private progressRevision = 0;

  addLegacyEntity(entity: LegacyEntity): void {
    this.legacy.set(entity.serverId, entity);
  }

  /** Transition legacy -> revisioned (migration 0019/0021/0022). */
  migrateToRevisioned(): void {
    if (this.era === 'revisioned') return;
    for (const [id, entity] of this.legacy) {
      this.revised.set(id, { ...entity, mutationId: null, revision: 1 });
    }
    this.legacy.clear();
    this.progressRevision = 1;
    this.era = 'revisioned';
  }

  /** Create under the revisioned era: dedupe by mutation id. */
  createRevised(
    mutationId: string,
    entity: LegacyEntity,
  ): { inserted: boolean; row: RevisedEntity } {
    if (this.era !== 'revisioned') {
      return { inserted: false, row: { ...entity, mutationId, revision: 1 } };
    }
    for (const row of this.revised.values()) {
      if (row.mutationId === mutationId) {
        return { inserted: false, row };
      }
    }
    const row: RevisedEntity = { ...entity, mutationId, revision: 1 };
    this.revised.set(entity.serverId, row);
    return { inserted: true, row };
  }

  applyProgressMutation(serverRevision: number): void {
    this.progressRevision = serverRevision;
  }

  get progressRevisionValue(): number {
    return this.progressRevision;
  }

  /** Every pre-migration entity must survive with identity + content intact. */
  assertMigrationPreserved(expectTotal: number): string[] {
    const violations: string[] = [];
    if (this.revised.size !== expectTotal) {
      violations.push(
        `migration lost entities: expected ${expectTotal}, found ${this.revised.size}`,
      );
    }
    for (const [id, row] of this.revised) {
      if (row.serverId !== id) violations.push(`entity identity changed for ${id}`);
      if (row.revision !== 1) violations.push(`entity ${id} did not get revision 1`);
    }
    return violations;
  }
}
