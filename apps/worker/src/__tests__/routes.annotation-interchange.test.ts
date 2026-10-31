import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ANNOTATION_INTERCHANGE_FORMAT,
  ANNOTATION_INTERCHANGE_VERSION,
} from '@do-epub-studio/schema';
import {
  makeEnv,
  makePassThroughContext,
  mockExecute,
  mockQueryFirst,
  mockRequireAuth,
} from './fixtures';
import { app } from '../app';
import type { AuthContext } from '../auth/middleware';

const auth: AuthContext = {
  email: 'reader@example.test',
  sessionId: 'session-1',
  bookId: 'book-1',
  capabilities: {
    canRead: true,
    canComment: true,
    canHighlight: true,
    canBookmark: true,
    canDownloadOffline: false,
    canExportNotes: false,
    canManageAccess: false,
  },
};
const document = {
  format: ANNOTATION_INTERCHANGE_FORMAT,
  version: ANNOTATION_INTERCHANGE_VERSION,
  type: 'AnnotationCollection',
  id: 'urn:uuid:collection',
  label: 'Synthetic title',
  source: 'urn:do-epub-studio:publication:book-1',
  items: [
    {
      id: 'urn:do-epub-studio:annotation:a1',
      type: 'Annotation',
      motivation: 'highlighting',
      target: {
        source: 'urn:do-epub-studio:publication:book-1',
        selector: {
          type: 'EPUBFragmentSelector',
          conformsTo: 'http://www.idpf.org/epub/linking/cfi/epub-cfi.html',
          value: 'epubcfi(/6/4)',
          locator: {
            cfi: 'epubcfi(/6/4)',
            chapterRef: 'chapter.xhtml',
            selectedText: 'synthetic quote',
          },
        },
      },
      body: { type: 'TextualBody', value: 'note', purpose: 'describing', format: 'text/plain' },
    },
  ],
};

const env = makeEnv();

describe('EPUB Annotations interchange storage route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue(auth);
  });

  it('stores a strict draft document under the authorized book and account', async () => {
    const response = await app.fetch(
      new Request('http://localhost/api/books/book-1/annotation-interchange', {
        method: 'PUT',
        headers: { Authorization: 'Bearer valid', 'Content-Type': 'application/json' },
        body: JSON.stringify(document),
      }),
      env,
      makePassThroughContext(),
    );
    expect(response.status).toBe(200);
    expect(mockExecute).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('annotation_interchange_documents'),
      ['book-1', auth.email, JSON.stringify(document)],
    );
  });

  it('returns only the current authorized profile document', async () => {
    mockQueryFirst.mockResolvedValueOnce({
      document_json: JSON.stringify(document),
      updated_at: '2026-10-31T00:00:00.000Z',
    });
    const response = await app.fetch(
      new Request('http://localhost/api/books/book-1/annotation-interchange', {
        headers: { Authorization: 'Bearer valid' },
      }),
      env,
      makePassThroughContext(),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, data: document });
  });

  it('rejects a profile for another publication and duplicate annotation IDs', async () => {
    const mismatched = { ...document, source: 'urn:do-epub-studio:publication:other' };
    const mismatchResponse = await app.fetch(
      new Request('http://localhost/api/books/book-1/annotation-interchange', {
        method: 'PUT',
        headers: { Authorization: 'Bearer valid', 'Content-Type': 'application/json' },
        body: JSON.stringify(mismatched),
      }),
      env,
      makePassThroughContext(),
    );
    expect(mismatchResponse.status).toBe(400);
    const duplicate = { ...document, items: [document.items[0], document.items[0]] };
    const duplicateResponse = await app.fetch(
      new Request('http://localhost/api/books/book-1/annotation-interchange', {
        method: 'PUT',
        headers: { Authorization: 'Bearer valid', 'Content-Type': 'application/json' },
        body: JSON.stringify(duplicate),
      }),
      env,
      makePassThroughContext(),
    );
    expect(duplicateResponse.status).toBe(400);
  });
});
