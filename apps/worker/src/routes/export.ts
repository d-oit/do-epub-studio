import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env } from '../lib/env';
import type { AuthContext } from '../auth/middleware';
import { queryAll } from '../db/client';
import { readerAuth } from '../middleware/auth';
import { assertBookAccess } from '../lib/tenant-isolation';

export const exportRouter = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

const ExportQuerySchema = z.object({
  format: z.enum(['markdown', 'html']).default('markdown'),
});

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

    const mismatch = await assertBookAccess(c.env, auth, bookId, c.executionCtx);
    if (mismatch) return mismatch.response;

    const highlights = await queryAll<HighlightRow>(
      c.env,
      `SELECT id, selected_text, color, note, chapter_ref, cfi_range, created_at
       FROM highlights WHERE book_id = ? AND user_email = ? ORDER BY created_at ASC`,
      [bookId, auth.email],
    );

    const comments = await queryAll<CommentRow>(
      c.env,
      `SELECT id, body, selected_text, chapter_ref, cfi_range, status, parent_comment_id, created_at
       FROM comments WHERE book_id = ? AND user_email = ? AND status != 'deleted' ORDER BY created_at ASC`,
      [bookId, auth.email],
    );

    const bookmarks = await queryAll<BookmarkRow>(
      c.env,
      `SELECT id, label, locator_json, created_at
       FROM bookmarks WHERE book_id = ? AND user_email = ? ORDER BY created_at ASC`,
      [bookId, auth.email],
    );

    const book = await c.env.DB.prepare(
      `SELECT title FROM books WHERE id = ?`,
    ).bind(bookId).first<{ title: string }>();

    const bookTitle = book?.title ?? 'Untitled';

    if (format === 'html') {
      return c.json({ ok: true, data: { format: 'html', title: bookTitle, content: generateHtmlExport(bookTitle, highlights, comments, bookmarks) } });
    }
    return c.json({ ok: true, data: { format: 'markdown', title: bookTitle, content: generateMarkdownExport(bookTitle, highlights, comments, bookmarks) } });
  },
);

function generateMarkdownExport(
  title: string,
  highlights: HighlightRow[],
  comments: CommentRow[],
  bookmarks: BookmarkRow[],
): string {
  const lines: string[] = [`# ${title}`, '', `> Exported on ${new Date().toISOString().split('T')[0]}`, ''];

  if (highlights.length > 0) {
    lines.push('## Highlights', '');
    for (const h of highlights) {
      const loc = h.chapter_ref ? ` (Chapter: ${h.chapter_ref})` : '';
      lines.push(`- **${h.selected_text}**${loc}`);
      if (h.note) lines.push(`  > ${h.note}`);
      lines.push('');
    }
  }

  if (comments.length > 0) {
    lines.push('## Comments', '');
    const topLevel = comments.filter((c) => !c.parent_comment_id);
    const replies = comments.filter((c) => c.parent_comment_id);
    for (const c of topLevel) {
      const loc = c.chapter_ref ? ` (Chapter: ${c.chapter_ref})` : '';
      if (c.selected_text) lines.push(`> "${c.selected_text}"${loc}`);
      lines.push(c.body);
      for (const r of replies.filter((r) => r.parent_comment_id === c.id)) {
        lines.push(`  > Reply: ${r.body}`);
      }
      lines.push('');
    }
  }

  if (bookmarks.length > 0) {
    lines.push('## Bookmarks', '');
    for (const b of bookmarks) lines.push(`- ${b.label ?? 'Untitled bookmark'}`);
    lines.push('');
  }

  return lines.join('\n');
}

function generateHtmlExport(
  title: string,
  highlights: HighlightRow[],
  comments: CommentRow[],
  bookmarks: BookmarkRow[],
): string {
  let html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${esc(title)}</title>
<style>body{font-family:Georgia,serif;max-width:800px;margin:0 auto;padding:2rem;line-height:1.6}
h1{color:#333;border-bottom:2px solid #ddd}h2{color:#555;margin-top:2rem}
blockquote{border-left:3px solid #ddd;padding-left:1rem;color:#666}
.hl{background:#fffde7;padding:.5rem;border-radius:4px;margin:.5rem 0}
.cm{background:#f5f5f5;padding:1rem;border-radius:4px;margin:1rem 0}
.rp{margin-left:2rem;border-left:2px solid #ddd;padding-left:1rem}
.meta{color:#999;font-size:.85rem}</style></head><body>
<h1>${esc(title)}</h1><p class="meta">Exported on ${new Date().toISOString().split('T')[0]}</p>`;

  if (highlights.length > 0) {
    html += '<h2>Highlights</h2>';
    for (const h of highlights) {
      const loc = h.chapter_ref ? ` — Chapter: ${esc(h.chapter_ref)}` : '';
      html += `<div class="hl"><strong>${esc(h.selected_text)}</strong>${loc}`;
      if (h.note) html += `<blockquote>${esc(h.note)}</blockquote>`;
      html += '</div>';
    }
  }

  if (comments.length > 0) {
    html += '<h2>Comments</h2>';
    const topLevel = comments.filter((c) => !c.parent_comment_id);
    const replies = comments.filter((c) => c.parent_comment_id);
    for (const c of topLevel) {
      const loc = c.chapter_ref ? ` — Chapter: ${esc(c.chapter_ref)}` : '';
      html += '<div class="cm">';
      if (c.selected_text) html += `<blockquote>"${esc(c.selected_text)}"${loc}</blockquote>`;
      html += `<p>${esc(c.body)}</p>`;
      for (const r of replies.filter((r) => r.parent_comment_id === c.id)) {
        html += `<div class="rp"><p><em>Reply:</em> ${esc(r.body)}</p></div>`;
      }
      html += '</div>';
    }
  }

  if (bookmarks.length > 0) {
    html += '<h2>Bookmarks</h2><ul>';
    for (const b of bookmarks) html += `<li>${esc(b.label ?? 'Untitled')}</li>`;
    html += '</ul>';
  }

  html += '</body></html>';
  return html;
}

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
