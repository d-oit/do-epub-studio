import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { Env } from '../lib/env';
import type { AuthContext } from '../auth/middleware';
import { queryAll, queryFirst } from '../db/client';
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
  user_email: string;
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
  user_email: string;
  created_at: string;
}

interface BookmarkRow {
  [key: string]: string | number | null | undefined;
  id: string;
  label: string | null;
  locator_json: string;
  user_email: string;
  created_at: string;
}

/**
 * GET /api/books/:id/export
 * Export a book's annotations in Markdown, HTML, JSON-LD, CSV, or JSON format.
 * Supports filtering by reviewer, tag, and status.
 * Requires read access to the book.
 */
exportRouter.get(
  '/books/:id/export',
  readerAuth,
  zValidator('query', ExportQuerySchema),
  async (c) => {
    const bookId = c.req.param('id');
    const { format, reviewer, tag, status } = c.req.valid('query');
    const auth = c.get('auth');

    const mismatch = await assertBookAccess(
      c.env,
      auth,
      bookId,
      c.executionCtx,
      getRequestTraceId(c),
    );
    if (mismatch) return mismatch.response;

    // Fetch user highlights, comments, bookmarks.
    // If reviewer filter is provided, filter by user_email matching reviewer.
    const userEmailFilter = reviewer && reviewer.length > 0 ? reviewer : auth.email;

    const [rawHighlights, rawComments, rawBookmarks] = await Promise.all([
      queryAll<HighlightRow>(
        c.env,
        `SELECT id, selected_text, color, note, chapter_ref, cfi_range, user_email, created_at
         FROM highlights WHERE book_id = ? AND user_email = ? ORDER BY created_at ASC LIMIT ?`,
        [bookId, userEmailFilter, MAX_EXPORT_ROWS],
      ),
      queryAll<CommentRow>(
        c.env,
        `SELECT id, body, selected_text, chapter_ref, cfi_range, status, parent_comment_id, user_email, created_at
         FROM comments WHERE book_id = ? AND user_email = ? AND status != 'deleted' ORDER BY created_at ASC LIMIT ?`,
        [bookId, userEmailFilter, MAX_EXPORT_ROWS],
      ),
      queryAll<BookmarkRow>(
        c.env,
        `SELECT id, label, locator_json, user_email, created_at
         FROM bookmarks WHERE book_id = ? AND user_email = ? ORDER BY created_at ASC LIMIT ?`,
        [bookId, userEmailFilter, MAX_EXPORT_ROWS],
      ),
    ]);

    // Filter by status if requested ('open' | 'resolved')
    let comments = rawComments;
    if (status === 'open') {
      comments = rawComments.filter((cm) => cm.status === 'open');
    } else if (status === 'resolved') {
      comments = rawComments.filter((cm) => cm.status === 'resolved');
    }

    // Filter by tag if requested (searches in highlight notes, comment bodies, bookmark labels)
    let highlights = rawHighlights;
    let bookmarks = rawBookmarks;
    if (tag && tag.length > 0) {
      const lowerTag = tag.toLowerCase();
      highlights = highlights.filter(
        (h) =>
          h.note?.toLowerCase().includes(lowerTag) ||
          h.selected_text.toLowerCase().includes(lowerTag),
      );
      comments = comments.filter(
        (cm) =>
          cm.body.toLowerCase().includes(lowerTag) ||
          cm.selected_text?.toLowerCase().includes(lowerTag),
      );
      bookmarks = bookmarks.filter((b) => b.label?.toLowerCase().includes(lowerTag));
    }

    const book = await queryFirst<{ title: string }>(
      c.env,
      `SELECT title FROM books WHERE id = ?`,
      [bookId],
    );

    const bookTitle = book?.title ?? 'Untitled';
    const data = prepareExport(highlights, comments, bookmarks);

    if (format === 'html') {
      return c.json({
        ok: true,
        data: { format: 'html', title: bookTitle, content: generateHtmlExport(bookTitle, data) },
      });
    }

    if (format === 'jsonld') {
      return c.json({
        ok: true,
        data: {
          format: 'jsonld',
          title: bookTitle,
          content: generateJsonLdExport(bookId, bookTitle, data),
        },
      });
    }

    if (format === 'csv') {
      return c.json({
        ok: true,
        data: { format: 'csv', title: bookTitle, content: generateCsvExport(data) },
      });
    }

    if (format === 'json') {
      return c.json({
        ok: true,
        data: {
          format: 'json',
          title: bookTitle,
          content: generateJsonExport(bookTitle, data),
        },
      });
    }

    return c.json({
      ok: true,
      data: {
        format: 'markdown',
        title: bookTitle,
        content: generateMarkdownExport(bookTitle, data),
      },
    });
  },
);

interface CommentThread {
  topLevel: CommentRow[];
  repliesByParent: Map<string, CommentRow[]>;
}

interface ExportData {
  highlights: HighlightRow[];
  comments: CommentThread;
  rawComments: CommentRow[];
  bookmarks: BookmarkRow[];
}

function threadComments(comments: CommentRow[]): CommentThread {
  const commentMap = new Map(comments.map((c) => [c.id, c]));
  const topLevel: CommentRow[] = [];
  const repliesByParent = new Map<string, CommentRow[]>();

  for (const c of comments) {
    if (!c.parent_comment_id || !commentMap.has(c.parent_comment_id)) {
      topLevel.push(c);
    } else {
      const list = repliesByParent.get(c.parent_comment_id) ?? [];
      list.push(c);
      repliesByParent.set(c.parent_comment_id, list);
    }
  }

  return { topLevel, repliesByParent };
}

function prepareExport(
  highlights: HighlightRow[],
  comments: CommentRow[],
  bookmarks: BookmarkRow[],
): ExportData {
  return { highlights, comments: threadComments(comments), rawComments: comments, bookmarks };
}

function generateMarkdownExport(title: string, data: ExportData): string {
  const lines: string[] = [`# ${escMd(title)}`, '', `> Exported on ${today()}`, ''];

  // Group items by Chapter for clear report structure
  const chapterMap = new Map<
    string,
    { highlights: HighlightRow[]; comments: CommentRow[]; bookmarks: BookmarkRow[] }
  >();

  const getChapterBucket = (chapterRef: string) => {
    let bucket = chapterMap.get(chapterRef);
    if (!bucket) {
      bucket = { highlights: [], comments: [], bookmarks: [] };
      chapterMap.set(chapterRef, bucket);
    }
    return bucket;
  };

  for (const h of data.highlights) {
    getChapterBucket(h.chapter_ref ?? 'General').highlights.push(h);
  }
  for (const c of data.comments.topLevel) {
    getChapterBucket(c.chapter_ref ?? 'General').comments.push(c);
  }
  for (const b of data.bookmarks) {
    let chRef = 'General';
    try {
      const parsed = JSON.parse(b.locator_json) as { chapterRef?: string };
      if (parsed.chapterRef) chRef = parsed.chapterRef;
    } catch {
      // ignore JSON parse errors
    }
    getChapterBucket(chRef).bookmarks.push(b);
  }

  if (chapterMap.size === 0) {
    lines.push('_No annotations found matching criteria._');
    return lines.join('\n');
  }

  for (const [chapter, items] of chapterMap.entries()) {
    lines.push(`## ${escMd(chapter)}`, '');

    if (items.highlights.length > 0) {
      lines.push('### Highlights', '');
      for (const h of items.highlights) {
        lines.push(`- **Quoted passage:** "${escMd(h.selected_text)}"`);
        if (h.cfi_range) lines.push(`  - Anchor/Location: \`${escMd(h.cfi_range)}\``);
        if (h.note) lines.push(`  - Note: ${escMd(h.note)}`);
        lines.push(`  - Timestamp: ${escMd(h.created_at)}`);
      }
      lines.push('');
    }

    if (items.comments.length > 0) {
      lines.push('### Comments', '');
      for (const c of items.comments) {
        lines.push(`- **Comment Thread** [${escMd(c.status)}]: ${escMd(c.body)}`);
        if (c.selected_text) lines.push(`  - Passage: "${escMd(c.selected_text)}"`);
        if (c.cfi_range) lines.push(`  - Location: \`${escMd(c.cfi_range)}\``);
        lines.push(`  - Reviewer: ${escMd(c.user_email)} | Timestamp: ${escMd(c.created_at)}`);
        const replies = data.comments.repliesByParent.get(c.id) ?? [];
        for (const r of replies) {
          lines.push(
            `    - Reply by ${escMd(r.user_email)} (${escMd(r.created_at)}): ${escMd(r.body)}`,
          );
        }
      }
      lines.push('');
    }

    if (items.bookmarks.length > 0) {
      lines.push('### Bookmarks', '');
      for (const b of items.bookmarks) {
        lines.push(`- ${escMd(b.label ?? 'Bookmark')} (${escMd(b.created_at)})`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
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
      const loc = h.chapter_ref ? ` — Chapter: ${esc(h.chapter_ref)}` : '';
      html += `<div class="hl"><strong>${esc(h.selected_text)}</strong>${loc}`;
      if (h.note) html += `<blockquote>${esc(h.note)}</blockquote>`;
      html += '</div>';
    }
  }

  if (data.comments.topLevel.length > 0) {
    html += '<h2>Comments</h2>';
    const { topLevel, repliesByParent } = data.comments;
    for (const c of topLevel) {
      const loc = c.chapter_ref ? ` — Chapter: ${esc(c.chapter_ref)}` : '';
      html += '<div class="cm">';
      if (c.selected_text) html += `<blockquote>"${esc(c.selected_text)}"${loc}</blockquote>`;
      html += `<p>[${esc(c.status)}] ${esc(c.body)}</p>`;
      for (const r of repliesByParent.get(c.id) ?? []) {
        html += `<div class="rp"><p><em>Reply (${esc(r.user_email)}):</em> ${esc(r.body)}</p></div>`;
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

/**
 * Web Annotation JSON-LD output per W3C Web Annotation Data Model profile.
 */
function generateJsonLdExport(bookId: string, title: string, data: ExportData): object {
  const items: object[] = [];
  for (const h of data.highlights) {
    items.push({
      '@context': 'http://www.w3.org/ns/anno.jsonld',
      id: `urn:uuid:${h.id}`,
      type: 'Annotation',
      motivation: 'highlighting',
      creator: { type: 'Person', email: h.user_email },
      created: h.created_at,
      target: {
        source: `urn:book:${bookId}`,
        selector: [
          { type: 'TextQuoteSelector', exact: h.selected_text },
          ...(h.cfi_range ? [{ type: 'FragmentSelector', value: h.cfi_range }] : []),
        ],
      },
      body: h.note ? [{ type: 'TextualBody', value: h.note, purpose: 'describing' }] : [],
    });
  }
  for (const cm of data.rawComments) {
    items.push({
      '@context': 'http://www.w3.org/ns/anno.jsonld',
      id: `urn:uuid:${cm.id}`,
      type: 'Annotation',
      motivation: 'commenting',
      creator: { type: 'Person', email: cm.user_email },
      created: cm.created_at,
      target: {
        source: `urn:book:${bookId}`,
        selector: cm.selected_text
          ? [
              { type: 'TextQuoteSelector', exact: cm.selected_text },
              ...(cm.cfi_range ? [{ type: 'FragmentSelector', value: cm.cfi_range }] : []),
            ]
          : [],
      },
      body: [{ type: 'TextualBody', value: cm.body, purpose: 'commenting' }],
      state: { status: cm.status },
    });
  }
  return {
    '@context': 'http://www.w3.org/ns/anno.jsonld',
    type: 'AnnotationCollection',
    label: `Annotations for ${title}`,
    total: items.length,
    first: { type: 'AnnotationPage', items },
  };
}

function generateCsvExport(data: ExportData): string {
  const rows: string[][] = [
    [
      'Type',
      'ID',
      'Chapter',
      'CFI/Location',
      'Text/Passage',
      'Content/Note/Body',
      'Reviewer',
      'Status',
      'Timestamp',
    ],
  ];
  for (const h of data.highlights) {
    rows.push([
      'highlight',
      h.id ?? '',
      h.chapter_ref ?? '',
      h.cfi_range ?? '',
      h.selected_text ?? '',
      h.note ?? '',
      h.user_email ?? '',
      'active',
      h.created_at ?? '',
    ]);
  }
  for (const cm of data.rawComments) {
    rows.push([
      'comment',
      cm.id ?? '',
      cm.chapter_ref ?? '',
      cm.cfi_range ?? '',
      cm.selected_text ?? '',
      cm.body ?? '',
      cm.user_email ?? '',
      cm.status ?? 'open',
      cm.created_at ?? '',
    ]);
  }
  for (const b of data.bookmarks) {
    rows.push([
      'bookmark',
      b.id ?? '',
      '',
      b.locator_json ?? '',
      '',
      b.label ?? '',
      b.user_email ?? '',
      'active',
      b.created_at ?? '',
    ]);
  }
  return rows
    .map((row) => row.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

function generateJsonExport(title: string, data: ExportData): object {
  return {
    title,
    exportedAt: today(),
    highlights: data.highlights,
    comments: data.rawComments,
    bookmarks: data.bookmarks,
  };
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function esc(text: string | null | undefined): string {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escMd(text: string | null | undefined): string {
  if (!text) return '';
  return String(text).replace(/([\\`*_{}[\]()#+-.!<>~])/g, '\\$1');
}
