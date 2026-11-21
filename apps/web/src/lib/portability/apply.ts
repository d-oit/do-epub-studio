import { apiRequest } from '../api/core';
import type { ImportPlan, PortabilityPreview } from './import';

export interface ApplyResult {
  applied: number;
  skipped: number;
  progressApplied: number;
  books: string[];
}

export interface ApplyOptions {
  token: string;
  preview: PortabilityPreview;
  plan: ImportPlan;
  signal?: AbortSignal;
  /** when true, only validate reachability (used by preview confirm flow) */
  dryRun?: boolean;
}

const AUTHORIZATION_HEADER = 'Authorization';

/**
 * Execute a confirmed import plan against the worker API. Every entity is
 * created with a deterministic `mutationId` derived from the envelope, so the
 * server's `ON CONFLICT(mutation_id) DO NOTHING` paths make re-imports
 * idempotent. Supports cancellation between operations; operations already
 * applied before cancellation remain applied (documented behavior).
 */
export async function applyImportPlan(options: ApplyOptions): Promise<ApplyResult> {
  const { token, plan, signal } = options;
  const result: ApplyResult = { applied: 0, skipped: 0, progressApplied: 0, books: [] };

  for (const op of plan.operations) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (options.dryRun) {
      result.applied += 1;
      continue;
    }

    if (op.kind === 'progress') {
      await apiRequest(`/api/books/${op.bookId}/progress`, {
        method: 'PUT',
        token,
        body: JSON.stringify(op.payload),
        signal,
      });
      result.progressApplied += 1;
    } else {
      const path =
        op.kind === 'highlight'
          ? `/api/books/${op.bookId}/highlights`
          : op.kind === 'comment'
            ? `/api/books/${op.bookId}/comments`
            : `/api/books/${op.bookId}/bookmarks`;
      await apiRequest(path, {
        method: 'POST',
        token,
        body: JSON.stringify(op.payload),
        signal,
      });
      result.applied += 1;
    }
    if (!result.books.includes(op.bookId)) result.books.push(op.bookId);
  }

  return result;
}

export { AUTHORIZATION_HEADER };
