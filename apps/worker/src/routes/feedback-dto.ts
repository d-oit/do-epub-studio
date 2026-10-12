// Reader-facing DTOs for the feedback routes, extracted from `feedback.ts`
// (ADR-278 warn-zone extraction). The row shapes and the provenance-resolving
// item builder are pure helpers; the route handlers stay in `feedback.ts`.
import type { Env, JsonRow } from '../lib/env';
import { resolveProvenance } from '../lib/feedback-provenance';

export interface FeedbackRow extends JsonRow {
  [key: string]: string | number | null | undefined;
  id: string;
  book_id: string;
  book_file_id: string | null;
  source_sha256: string | null;
  chapter_ref: string | null;
  cfi: string | null;
  selected_text: string | null;
  prefix: string | null;
  suffix: string | null;
  kind: string;
  category: string;
  body: string;
  reference_revisions: string | null;
  anchor_state: string;
  created_at: string;
  updated_at: string;
}

export interface ReplyRow extends JsonRow {
  id: string;
  feedback_id: string;
  author_email: string;
  author_role: string;
  body: string;
  created_at: string;
}

/** A reader-facing item with its read-time provenance resolved. */
export async function readerItem(
  env: Env,
  row: FeedbackRow,
  replies: ReplyRow[] = [],
  replyCount = 0,
  baseline?: Record<string, number>,
): Promise<Record<string, unknown>> {
  const provenance = await resolveProvenance(env, row, baseline);
  return {
    id: row.id,
    kind: row.kind,
    category: row.category,
    body: row.body,
    proposedText: row.proposed_text,
    anchor: {
      bookFileId: row.book_file_id,
      chapterRef: row.chapter_ref,
      cfi: row.cfi,
      selectedText: row.selected_text,
      prefix: row.prefix,
      suffix: row.suffix,
    },
    anchorState: provenance.anchorState,
    referenceRevisions: provenance.pinnedReferences,
    referencesDrifted: provenance.referencesDrifted,
    status: row.status,
    isOwn: true,
    replyCount,
    replies: replies.map((r) => ({
      id: r.id,
      body: r.body,
      authorRole: r.author_role,
      isOwn: true,
      createdAt: r.created_at,
    })),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
