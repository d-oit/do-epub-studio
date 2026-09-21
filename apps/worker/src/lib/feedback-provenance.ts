import type { Env } from './env';
import { queryAll, queryFirst } from '../db/client';

/**
 * Editorial provenance shared by the reader and creator feedback surfaces
 * (Wave 3, COL-03). Both routes must derive these facts the same way: the
 * states are computed at read time and never accepted from a client.
 *
 * - `anchorState` describes whether the passage an item points at still
 *   matches the source file it was captured from.
 * - `referencesDrifted` describes whether the reference revisions the item
 *   pinned at submission are still current.
 */
export interface ProvenanceRow {
  book_id: string;
  book_file_id: string | null;
  source_sha256: string | null;
  reference_revisions: string | null;
}

export type AnchorState = 'unresolved' | 'resolved' | 'source_changed';

/**
 * Compute the anchor state at READ time (Wave 3, COL-03):
 * - `resolved`      — stored source sha matches the current book_files sha.
 * - `source_changed`— the book file's sha no longer matches the stored
 *                     evidence sha; the item stays readable but the source
 *                     moved. Never auto-applied.
 * - `unresolved`    — no source identity to match (book-level feedback or
 *                     missing anchor). Honest absence, never a guess.
 */
export async function computeAnchorState(env: Env, row: ProvenanceRow): Promise<AnchorState> {
  if (!row.book_file_id) {
    return 'unresolved';
  }
  const file = await queryFirst<{ sha256: string | null }>(
    env,
    `SELECT sha256 FROM book_files WHERE id = ?`,
    [row.book_file_id],
  );
  if (!file) {
    return 'source_changed';
  }
  if (file.sha256 && row.source_sha256 && file.sha256 === row.source_sha256) {
    return 'resolved';
  }
  return 'source_changed';
}

export function parseReferenceRevisions(row: ProvenanceRow): Record<string, number> {
  if (typeof row.reference_revisions !== 'string' || row.reference_revisions.length === 0) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(row.reference_revisions);
    if (typeof parsed === 'object' && parsed !== null) {
      const out: Record<string, number> = {};
      for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof value === 'number') out[key] = value;
      }
      return out;
    }
    return {};
  } catch {
    return {};
  }
}

/** Current revision of every reference on the book: the baseline a pin is compared against. */
export async function currentReferenceRevisions(env: Env, bookId: string): Promise<Record<string, number>> {
  const rows = await queryAll<{ id: string; revision: number }>(
    env,
    `SELECT id, revision FROM book_references WHERE book_id = ?`,
    [bookId],
  );
  const out: Record<string, number> = {};
  for (const row of rows) {
    out[row.id] = row.revision;
  }
  return out;
}

/**
 * True when the evidence an item pinned is no longer current: a pinned
 * reference was edited (revision moved) or deleted. Items created before
 * pinning existed carry no pins and therefore never claim drift.
 */
export function referencesDrifted(
  pinned: Record<string, number>,
  current: Record<string, number>,
): boolean {
  const ids = Object.keys(pinned);
  if (ids.length === 0) return false;
  return ids.some((id) => current[id] !== pinned[id]);
}

export interface ItemProvenance {
  anchorState: AnchorState;
  referencesDrifted: boolean;
  pinnedReferences: Record<string, number>;
}

/** Resolve both provenance facts for one row; pass `baseline` to reuse a per-request query. */
export async function resolveProvenance(
  env: Env,
  row: ProvenanceRow,
  baseline?: Record<string, number>,
): Promise<ItemProvenance> {
  const pinnedReferences = parseReferenceRevisions(row);
  const [anchorState, current] = await Promise.all([
    computeAnchorState(env, row),
    baseline ? Promise.resolve(baseline) : currentReferenceRevisions(env, row.book_id),
  ]);
  return {
    anchorState,
    referencesDrifted: referencesDrifted(pinnedReferences, current),
    pinnedReferences,
  };
}
