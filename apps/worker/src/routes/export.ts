import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { Env } from '../lib/env';
import type { AuthContext } from '../auth/middleware';
import { queryAll } from '../db/client';
import { readerAuth } from '../middleware/auth';
import { assertBookAccess } from '../lib/tenant-isolation';
import { getRequestTraceId } from '../lib/api-error';
import { ExportQuerySchema } from '@do-epub-studio/schema';

/** Maximum rows per entity type to prevent unbounded memory usage on large exports. */
const MAX_EXPORT_ROWS = 10_000;

export const exportRouter = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

interface HighlightRow {
  [key: string]: string | number | null | undefined;
  id: string;
  selected_text: string;
  color: string;
  note: string | null;
  chapter_ref: string | null;
  cfi_range: string | null;
  created_at: string;
}

interface CommentRow {
  [key: string]: string | number | null | undefined;
  id: string;
  body: string;
  selected_text: string | null;
  chapter_ref: string | null;
  cfi_range: string | null;
  status: string;
  parent_comment_id: string | null;
  created_at: string;
}

interface BookmarkRow {
  [key: string]: string | number | null | undefined;
  id: string;
  label: string | null;
  locator_json: string;
  created_at: string;
}

/**
 * GET /api/books/:id/export
 * Export a book's annotations as Markdown or HTML.
 * Requires read access to the book.
 */
exportRouter.get(
  '/books/:id/export',
  readerAuth,
  zValidator('query', ExportQuerySchema),
  async (c) => {
    const bookId = c.req.param('id');
    const { format } = c.req.valid('query');
    const auth = c.get('auth');

    const mismatch = await assertBookAccess(c.env, auth, bookId, c.executionCtx, getRequestTraceId(c));
    if (mismatch) return mismatch.response;

    // The three queries are independent (separate tables, each with its own
    // internal ORDER BY and a bounded LIMIT), so they can run concurrently.
    // Each result is a complete, ordered array — the Markdown/Html generator
    // combines them downstream without relying on cross-query interleaving, so
    // concurrent execution preserves the output exactly.
    const [highlights, comments, bookmarks] = await Promise.all([
      queryAll<HighlightRow>(
        c.env,
        `SELECT id, selected_text, color, note, chapter_ref, cfi_range, created_at
         FROM highlights WHERE book_id = ? AND user_email = ? ORDER BY created_at ASC LIMIT ?`,
        [bookId, auth.email, MAX_EXPORT_ROWS],
      ),
      queryAll<CommentRow>(
        c.env,
        `SELECT id, body, selected_text, chapter_ref, cfi_range, status, parent_comment_id, created_at
         FROM comments WHERE book_id = ? AND user_email = ? AND status != 'deleted' ORDER BY created_at ASC LIMIT ?`,
        [bookId, auth.email, MAX_EXPORT_ROWS],
      ),
      queryAll<BookmarkRow>(
        c.env,
        `SELECT id, label, locator_json, created_at
         FROM bookmarks WHERE book_id = ? AND user_email = ? ORDER BY created_at ASC LIMIT ?`,
        [bookId, auth.email, MAX_EXPORT_ROWS],
      ),
    ]);

    const book = await c.env.DB.prepare(
      `SELECT title FROM books WHERE id = ?`,
    ).bind(bookId).first<{ title: string }>();

    const bookTitle = book?.title ?? 'Untitled';

    // Prepare (thread) the rows once; each generator is a pure renderer over
    // the prepared data, so neither re-derives the parent/reply structure.
    const data = prepareExport(highlights, comments, bookmarks);

    if (format === 'html') {
      return c.json({ ok: true, data: { format: 'html', title: bookTitle, content: generateHtmlExport(bookTitle, data) } });
    }
    return c.json({ ok: true, data: { format: 'markdown', title: bookTitle, content: generateMarkdownExport(bookTitle, data) } });
  },
);

function generateMarkdownExport(title: string, data: ExportData): string {
  const lines: string[] = [`# ${escMd(title)}`, '', `> Exported on ${today()}`, ''];

  mdSection(lines, '## Highlights', data.highlights.map(mdHighlightLines));
  mdSection(lines, '## Comments', mdCommentBlocks(data.comments));
  mdSection(lines, '## Bookmarks', data.bookmarks.map(mdBookmarkLines));

  return lines.join('\n');
}

/** Today's date as `YYYY-MM-DD`, shared by both export formats. */
function today(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Render a Markdown section (heading + blank line + item blocks + trailing
 * blank line) when `blocks` is non-empty. Keeps the per-entity renderers
 * focused on a single block instead of repeating the section scaffolding.
 */
function mdSection(lines: string[], heading: string, blocks: string[][]): void {
  if (blocks.length === 0) return;
  lines.push(heading, '');
  for (const block of blocks) lines.push(...block);
  lines.push('');
}

/** Chapter location suffix for Markdown, or an empty string when absent. */
function chapterLocMd(chapterRef: string | null): string {
  return chapterRef ? ` (Chapter: ${escMd(chapterRef)})` : '';
}

/** Chapter location suffix for HTML, or an empty string when absent. */
function chapterLocHtml(chapterRef: string | null): string {
  return chapterRef ? ` — Chapter: ${esc(chapterRef)}` : '';
}

function mdHighlightLines(h: HighlightRow): string[] {
  const lines = [`- **${escMd(h.selected_text)}**${chapterLocMd(h.chapter_ref)}`];
  if (h.note) lines.push(`  > ${escMd(h.note)}`);
  return lines;
}

/** Comments grouped into top-level threads with their replies, in source order. */
interface CommentThread {
  topLevel: CommentRow[];
  repliesByParent: Map<string, CommentRow[]>;
}

/**
 * Group comments into top-level threads with their replies, preserving source
 * order. Shared by both the Markdown and HTML generators so each renders the
 * same comment tree without re-deriving the parent/reply structure.
 */
function threadComments(comments: CommentRow[]): CommentThread {
  const topLevel = comments.filter((c) => !c.parent_comment_id);
  const repliesByParent = new Map<string, CommentRow[]>();
  for (const r of comments) {
    if (!r.parent_comment_id) continue;
    const list = repliesByParent.get(r.parent_comment_id) ?? [];
    list.push(r);
    repliesByParent.set(r.parent_comment_id, list);
  }
  return { topLevel, repliesByParent };
}

/** Shared row data both export generators consume, prepared once. */
interface ExportData {
  highlights: HighlightRow[];
  comments: CommentThread;
  bookmarks: BookmarkRow[];
}

/**
 * Prepare the query rows in a single place (called once in the route handler)
 * so both generators are pure renderers over already-threaded data instead of
 * re-deriving the parent/reply structure themselves.
 */
function prepareExport(
  highlights: HighlightRow[],
  comments: CommentRow[],
  bookmarks: BookmarkRow[],
): ExportData {
  return { highlights, comments: threadComments(comments), bookmarks };
}

/** Render one block per top-level comment (with its replies) in source order. */
function mdCommentBlocks(thread: CommentThread): string[][] {
  const { topLevel, repliesByParent } = thread;
  return topLevel.map((c) => {
    const lines: string[] = [];
    if (c.selected_text) lines.push(`> "${escMd(c.selected_text)}"${chapterLocMd(c.chapter_ref)}`);
    lines.push(escMd(c.body));
    for (const r of repliesByParent.get(c.id) ?? []) lines.push(`  > Reply: ${escMd(r.body)}`);
    return lines;
  });
}

/** Render a single bookmark as a Markdown list item block. */
function mdBookmarkLines(b: BookmarkRow): string[] {
  return [`- ${escMd(b.label ?? 'Untitled bookmark')}`];
}

function generateHtmlExport(title: string, data: ExportData): string {
  let html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${esc(title)}</title>
<style>body{font-family:Georgia,serif;max-width:800px;margin:0 auto;padding:2rem;line-height:1.6}
h1{color:#333;border-bottom:2px solid #ddd}h2{color:#555;margin-top:2rem}
blockquote{border-left:3px solid #ddd;padding-left:1rem;color:#666}
.hl{background:#fffde7;padding:.5rem;border-radius:4px;margin:.5rem 0}
.cm{background:#f5f5f5;padding:1rem;border-radius:4px;margin:1rem 0}
.rp{margin-left:2rem;border-left:2px solid #ddd;padding-left:1rem}
.meta{color:#999;font-size:.85rem}</style></head><body>
<h1>${esc(title)}</h1><p class="meta">Exported on ${today()}</p>`;

  if (data.highlights.length > 0) {
    html += '<h2>Highlights</h2>';
    for (const h of data.highlights) {
      const loc = chapterLocHtml(h.chapter_ref);
      html += `<div class="hl"><strong>${esc(h.selected_text)}</strong>${loc}`;
      if (h.note) html += `<blockquote>${esc(h.note)}</blockquote>`;
      html += '</div>';
    }
  }

  if (data.comments.topLevel.length > 0) {
    html += '<h2>Comments</h2>';
    const { topLevel, repliesByParent } = data.comments;
    for (const c of topLevel) {
      const loc = chapterLocHtml(c.chapter_ref);
      html += '<div class="cm">';
      if (c.selected_text) html += `<blockquote>"${esc(c.selected_text)}"${loc}</blockquote>`;
      html += `<p>${esc(c.body)}</p>`;
      for (const r of repliesByParent.get(c.id) ?? []) {
        html += `<div class="rp"><p><em>Reply:</em> ${esc(r.body)}</p></div>`;
      }
      html += '</div>';
    }
  }

  if (data.bookmarks.length > 0) {
    html += '<h2>Bookmarks</h2><ul>';
    for (const b of data.bookmarks) html += `<li>${esc(b.label ?? 'Untitled')}</li>`;
    html += '</ul>';
  }

  html += '</body></html>';
  return html;
}

function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Escape Markdown syntax characters so user-authored annotation text cannot
 * inject list structure, headers, or links into the exported Markdown.
 */
function escMd(text: string): string {
  return text.replace(/([\\`*_{}[\]()#+-.!<>~])/g, '\\$1');
}
