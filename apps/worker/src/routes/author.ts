import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import {
  AuthorPublicationSchema,
  SaveManuscriptDraftSchema,
  CreateBookSchema,
} from '@do-epub-studio/shared';
import type { Env } from '../lib/env';
import { execute, queryFirst } from '../db/client';
import { authorAuth } from '../middleware/auth';
import { NotFoundError, ConflictError } from '../lib/http-errors';
import { logAudit } from '../audit';
import { handlePublishManuscript } from './author-publish';

export const authorRouter = new Hono<{
  Bindings: Env;
  Variables: { authorUser: { email: string; id: string; role: string } };
}>();

const CreateAuthorBookSchema = CreateBookSchema.extend({
  template: z.enum(['blank', 'novel', 'guide']).default('blank'),
});

/**
 * POST /api/author/books
 * Creates a new publication manuscript from scratch or template without requiring an initial EPUB upload.
 */
authorRouter.post('/books', authorAuth, zValidator('json', CreateAuthorBookSchema), async (c) => {
  const body = c.req.valid('json');
  const existing = await queryFirst<{ id: string }>(
    c.env,
    'SELECT id FROM books WHERE slug = ? AND archived_at IS NULL LIMIT 1',
    [body.slug],
  );

  if (existing) {
    throw new ConflictError('A book with this slug already exists');
  }

  const bookId = crypto.randomUUID();
  const now = new Date().toISOString();

  await execute(
    c.env,
    `INSERT INTO books (id, slug, title, author_name, description, language, visibility, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      bookId,
      body.slug,
      body.title,
      body.authorName ?? null,
      body.description ?? null,
      body.language || 'en',
      body.visibility || 'private',
      now,
      now,
    ],
  );

  let initialChapters = [
    {
      id: 'chapter-1',
      title: 'Chapter 1',
      order: 0,
      contentHtml: '<p>Start writing your manuscript here.</p>',
    },
  ];

  if (body.template === 'novel') {
    initialChapters = [
      {
        id: 'prologue',
        title: 'Prologue',
        order: 0,
        contentHtml: '<p>Begin writing the prologue here.</p>',
      },
      {
        id: 'chapter-1',
        title: 'Chapter 1',
        order: 1,
        contentHtml: '<p>Begin writing chapter 1 here.</p>',
      },
    ];
  } else if (body.template === 'guide') {
    initialChapters = [
      {
        id: 'overview',
        title: 'Overview',
        order: 0,
        contentHtml: '<p>Overview and key objectives of this guide.</p>',
      },
      {
        id: 'getting-started',
        title: 'Getting Started',
        order: 1,
        contentHtml: '<p>Step-by-step instructions to get started.</p>',
      },
    ];
  }

  const publication = {
    title: body.title,
    authorName: body.authorName || 'Anonymous',
    language: body.language || 'en',
    description: body.description || undefined,
    chapters: initialChapters,
  };

  await execute(
    c.env,
    `INSERT INTO book_manuscript_drafts (book_id, publication_json, draft_version, created_at, updated_at)
       VALUES (?, ?, 1, ?, ?)`,
    [bookId, JSON.stringify(publication), now, now],
  );

  await logAudit(
    c.env,
    {
      entityType: 'book',
      entityId: bookId,
      action: 'book.authoring_created',
      payload: { slug: body.slug, title: body.title, template: body.template },
    },
    c.executionCtx,
  );

  return c.json(
    {
      ok: true,
      data: {
        bookId,
        slug: body.slug,
        title: body.title,
        publication,
        draftVersion: 1,
        createdAt: now,
      },
    },
    201,
  );
});

/**
 * GET /api/author/books/:id/manuscript
 * Fetches the current manuscript draft for editing.
 */
authorRouter.get('/books/:id/manuscript', authorAuth, async (c) => {
  const bookId = c.req.param('id');
  if (!bookId) {
    throw new NotFoundError('Book');
  }
  const book = await queryFirst<{
    id: string;
    slug: string;
    title: string;
    author_name: string | null;
    description: string | null;
    language: string;
  }>(
    c.env,
    'SELECT id, slug, title, author_name, description, language FROM books WHERE id = ? AND archived_at IS NULL LIMIT 1',
    [bookId],
  );

  if (!book) {
    throw new NotFoundError('Book');
  }

  const draftRow = await queryFirst<{
    publication_json: string;
    draft_version: number;
    updated_at: string;
  }>(
    c.env,
    'SELECT publication_json, draft_version, updated_at FROM book_manuscript_drafts WHERE book_id = ? LIMIT 1',
    [bookId],
  );

  if (draftRow) {
    const publication = AuthorPublicationSchema.parse(JSON.parse(draftRow.publication_json));
    return c.json({
      ok: true,
      data: {
        bookId,
        publication,
        draftVersion: draftRow.draft_version,
        updatedAt: draftRow.updated_at,
      },
    });
  }

  // Initialize a default draft if none exists yet for an existing book
  const defaultPublication = {
    title: book.title,
    authorName: book.author_name || 'Anonymous',
    language: book.language || 'en',
    description: book.description || undefined,
    chapters: [
      {
        id: 'chapter-1',
        title: 'Chapter 1',
        order: 0,
        contentHtml: '<p>Start writing your manuscript here.</p>',
      },
    ],
  };

  const now = new Date().toISOString();
  await execute(
    c.env,
    `INSERT INTO book_manuscript_drafts (book_id, publication_json, draft_version, created_at, updated_at)
     VALUES (?, ?, 1, ?, ?)`,
    [bookId, JSON.stringify(defaultPublication), now, now],
  );

  return c.json({
    ok: true,
    data: {
      bookId,
      publication: defaultPublication,
      draftVersion: 1,
      updatedAt: now,
    },
  });
});

/**
 * PUT /api/author/books/:id/manuscript
 * Saves manuscript draft with optimistic concurrency versioning.
 */
authorRouter.put(
  '/books/:id/manuscript',
  authorAuth,
  zValidator('json', SaveManuscriptDraftSchema),
  async (c) => {
    const bookId = c.req.param('id');
    if (!bookId) {
      throw new NotFoundError('Book');
    }
    const { publication, expectedVersion } = c.req.valid('json');

    const book = await queryFirst<{ id: string }>(
      c.env,
      'SELECT id FROM books WHERE id = ? AND archived_at IS NULL LIMIT 1',
      [bookId],
    );

    if (!book) {
      throw new NotFoundError('Book');
    }

    const currentDraft = await queryFirst<{
      publication_json: string;
      draft_version: number;
    }>(
      c.env,
      'SELECT publication_json, draft_version FROM book_manuscript_drafts WHERE book_id = ? LIMIT 1',
      [bookId],
    );

    if (
      currentDraft &&
      expectedVersion !== undefined &&
      currentDraft.draft_version !== expectedVersion
    ) {
      return c.json(
        {
          ok: false,
          error: {
            code: 'CONCURRENCY_CONFLICT',
            message:
              'The manuscript was updated by another session. Please reload to review the latest changes.',
            currentVersion: currentDraft.draft_version,
            currentDraft: JSON.parse(currentDraft.publication_json) as unknown,
          },
        },
        409,
      );
    }

    const newVersion = (currentDraft?.draft_version ?? 0) + 1;
    const now = new Date().toISOString();

    await execute(
      c.env,
      `INSERT INTO book_manuscript_drafts (book_id, publication_json, draft_version, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(book_id) DO UPDATE SET
         publication_json = excluded.publication_json,
         draft_version = excluded.draft_version,
         updated_at = excluded.updated_at`,
      [bookId, JSON.stringify(publication), newVersion, now],
    );

    // Keep book table metadata in sync with the manuscript header
    await execute(
      c.env,
      `UPDATE books
       SET title = ?, author_name = ?, description = ?, language = ?, updated_at = ?
       WHERE id = ?`,
      [
        publication.title,
        publication.authorName ?? null,
        publication.description ?? null,
        publication.language || 'en',
        now,
        bookId,
      ],
    );

    return c.json({
      ok: true,
      data: {
        bookId,
        publication,
        draftVersion: newVersion,
        updatedAt: now,
      },
    });
  },
);

/**
 * POST /api/author/books/:id/publish
 * Compiles the manuscript draft into a deterministic EPUB 3 archive,
 * validates archive safety, stores in R2, creates an immutable revision, and enqueues EPUBCheck.
 */
authorRouter.post('/books/:id/publish', authorAuth, handlePublishManuscript);
