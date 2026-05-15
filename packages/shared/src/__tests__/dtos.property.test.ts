import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type {
  ApiResponse,
  PaginatedResponse,
  BookResponse,
  AccessResponse,
  SignedUrlResponse,
  ProgressResponse,
  HighlightResponse,
  CommentResponse,
  AuditLogResponse,
  GrantResponse,
  SyncQueueItem,
  ReaderCapabilities,
} from '../dtos';

const nonEmptyString = fc.string({ minLength: 1, maxLength: 100 });
const optionalString = fc.oneof(fc.constant(null), fc.string({ maxLength: 100 }));
const isoDateString = fc.string({ minLength: 10, maxLength: 30 });

const readerCapabilitiesArb: fc.Arbitrary<ReaderCapabilities> = fc.record({
  canRead: fc.boolean(),
  canComment: fc.boolean(),
  canHighlight: fc.boolean(),
  canBookmark: fc.boolean(),
  canDownloadOffline: fc.boolean(),
  canExportNotes: fc.boolean(),
  canManageAccess: fc.boolean(),
});

const bookResponseArb: fc.Arbitrary<BookResponse> = fc.record({
  id: nonEmptyString,
  slug: fc.string({ minLength: 1, maxLength: 50 }),
  title: fc.string({ minLength: 1, maxLength: 100 }),
  authorName: optionalString,
  description: optionalString,
  language: fc.string({ minLength: 2, maxLength: 10 }),
  visibility: fc.constantFrom('private', 'public', 'password_protected', 'reader_only', 'editorial_review'),
  coverImageUrl: optionalString,
  publishedAt: optionalString,
});

const signedUrlResponseArb: fc.Arbitrary<SignedUrlResponse> = fc.record({
  url: fc.string({ minLength: 1 }),
  expiresAt: isoDateString,
  fileSize: fc.integer({ min: 0 }),
  mimeType: fc.string({ minLength: 1 }),
});

const progressResponseArb: fc.Arbitrary<ProgressResponse> = fc.record({
  locator: fc.string({ minLength: 1 }),
  progressPercent: fc.double({ min: 0, max: 100, noNaN: true }),
  updatedAt: isoDateString,
});

const highlightResponseArb: fc.Arbitrary<HighlightResponse> = fc.record({
  id: nonEmptyString,
  chapterRef: optionalString,
  cfiRange: optionalString,
  selectedText: fc.string(),
  note: optionalString,
  color: fc.string(),
  createdAt: isoDateString,
  updatedAt: isoDateString,
});

const syncQueueItemArb: fc.Arbitrary<SyncQueueItem> = fc.record({
  idempotencyKey: nonEmptyString,
  entityType: fc.string({ minLength: 1 }),
  entityId: fc.string({ minLength: 1 }),
  operation: fc.constantFrom('create', 'update', 'delete' as const),
  payload: fc.string(),
  createdAt: isoDateString,
});

const grantResponseArb: fc.Arbitrary<GrantResponse> = fc.record({
  id: nonEmptyString,
  email: fc.string({ minLength: 3 }),
  mode: fc.constantFrom('private', 'public', 'password_protected', 'reader_only', 'editorial_review'),
  commentsAllowed: fc.boolean(),
  offlineAllowed: fc.boolean(),
  expiresAt: optionalString,
  createdAt: isoDateString,
  revokedAt: optionalString,
});

const _auditLogResponseArb: fc.Arbitrary<AuditLogResponse> = fc.record({
  id: nonEmptyString,
  actorEmail: optionalString,
  entityType: fc.string({ minLength: 1 }),
  entityId: fc.string({ minLength: 1 }),
  action: fc.string({ minLength: 1 }),
  payload: fc.oneof(fc.constant(null), fc.constant({})),
  createdAt: isoDateString,
});

function roundTrip<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe('DTO JSON round-trip', () => {
  it('BookResponse fields are preserved', () => {
    fc.assert(
      fc.property(bookResponseArb, (original) => {
        const parsed = roundTrip(original);
        expect(parsed.id).toBe(original.id);
        expect(parsed.slug).toBe(original.slug);
        expect(parsed.title).toBe(original.title);
        expect(parsed.authorName).toBe(original.authorName);
        expect(parsed.description).toBe(original.description);
        expect(parsed.language).toBe(original.language);
        expect(parsed.visibility).toBe(original.visibility);
        expect(parsed.coverImageUrl).toBe(original.coverImageUrl);
        expect(parsed.publishedAt).toBe(original.publishedAt);
      }),
    );
  });

  it('SignedUrlResponse fields are preserved', () => {
    fc.assert(
      fc.property(signedUrlResponseArb, (original) => {
        const parsed = roundTrip(original);
        expect(parsed.url).toBe(original.url);
        expect(parsed.expiresAt).toBe(original.expiresAt);
        expect(parsed.fileSize).toBe(original.fileSize);
        expect(parsed.mimeType).toBe(original.mimeType);
      }),
    );
  });

  it('ProgressResponse fields are preserved', () => {
    fc.assert(
      fc.property(progressResponseArb, (original) => {
        const parsed = roundTrip(original);
        expect(parsed.locator).toBe(original.locator);
        expect(parsed.progressPercent).toBe(original.progressPercent);
        expect(parsed.updatedAt).toBe(original.updatedAt);
      }),
    );
  });

  it('HighlightResponse fields are preserved', () => {
    fc.assert(
      fc.property(highlightResponseArb, (original) => {
        const parsed = roundTrip(original);
        expect(parsed.id).toBe(original.id);
        expect(parsed.selectedText).toBe(original.selectedText);
        expect(parsed.color).toBe(original.color);
        expect(parsed.createdAt).toBe(original.createdAt);
        expect(parsed.updatedAt).toBe(original.updatedAt);
      }),
    );
  });

  it('SyncQueueItem fields are preserved and operation is valid', () => {
    fc.assert(
      fc.property(syncQueueItemArb, (original) => {
        const parsed = roundTrip(original);
        expect(parsed.idempotencyKey).toBe(original.idempotencyKey);
        expect(parsed.operation).toBe(original.operation);
        expect(['create', 'update', 'delete']).toContain(parsed.operation);
      }),
    );
  });
});

describe('ApiResponse invariants', () => {
  it('ok:true has data, ok:false has error', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.integer(),
        (ok, value) => {
          const response: ApiResponse<number> = ok
            ? { ok, data: value }
            : { ok, error: { code: 'ERR', message: 'fail' } };
          expect(response.ok).toBe(ok);
          if (ok) {
            expect(response.data).toBe(value);
            expect(response.error).toBeUndefined();
          } else {
            expect(response.error).toBeDefined();
            expect(response.error!.code).toBe('ERR');
            expect(response.data).toBeUndefined();
          }
        },
      ),
    );
  });

  it('round-trips through JSON while preserving structure', () => {
    fc.assert(
      fc.property(fc.integer(), (value) => {
        const original: ApiResponse<number> = { ok: true, data: value };
        const parsed = roundTrip(original);
        expect(parsed.ok).toBe(true);
        expect(parsed.data).toBe(value);
      }),
    );
  });
});

describe('PaginatedResponse invariants', () => {
  it('hasMore is consistent with page and pageSize', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer(), { minLength: 0, maxLength: 50 }),
        fc.integer({ min: 0, max: 1000 }),
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        (items, total, pageSize, page) => {
          fc.pre(items.length <= pageSize);
          const paginated: PaginatedResponse<number> = {
            items,
            total,
            page,
            pageSize,
            hasMore: (page + 1) * pageSize < total,
          };
          expect(paginated.hasMore).toBe((page + 1) * pageSize < total);
          expect(typeof paginated.total).toBe('number');
          expect(typeof paginated.page).toBe('number');
          expect(typeof paginated.pageSize).toBe('number');
          expect(Array.isArray(paginated.items)).toBe(true);
        },
      ),
    );
  });

  it('items array length never exceeds pageSize', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string(), { minLength: 0, maxLength: 20 }),
        fc.integer({ min: 0, max: 500 }),
        fc.integer({ min: 1, max: 50 }),
        (items, total, pageSize) => {
          fc.pre(items.length <= pageSize);
          const paginated: PaginatedResponse<string> = {
            items,
            total,
            page: 0,
            pageSize,
            hasMore: pageSize < total,
          };
          expect(paginated.items.length).toBeLessThanOrEqual(paginated.pageSize);
        },
      ),
    );
  });
});

describe('AccessResponse structure', () => {
  it('contains valid book and capabilities', () => {
    fc.assert(
      fc.property(
        nonEmptyString,
        bookResponseArb,
        readerCapabilitiesArb,
        (sessionToken, book, capabilities) => {
          const response: AccessResponse = { sessionToken, book, capabilities };
          const parsed = roundTrip(response);
          expect(parsed.sessionToken).toBe(sessionToken);
          expect(parsed.book.id).toBe(book.id);
          expect(parsed.capabilities.canRead).toBe(capabilities.canRead);
          expect(parsed.capabilities.canComment).toBe(capabilities.canComment);
        },
      ),
    );
  });
});

describe('GrantResponse invariants', () => {
  it('revokedAt is null or a date string', () => {
    fc.assert(
      fc.property(grantResponseArb, (grant) => {
        const parsed = roundTrip(grant);
        expect(parsed.revokedAt === null || typeof parsed.revokedAt === 'string').toBe(true);
        expect(parsed.expiresAt === null || typeof parsed.expiresAt === 'string').toBe(true);
      }),
    );
  });
});

describe('CommentResponse structure', () => {
  it('replies is optional and defaults to undefined', () => {
    fc.assert(
      fc.property(
        nonEmptyString,
        fc.string(),
        fc.string(),
        fc.string(),
        (id, userEmail, body, createdAt) => {
          const comment: CommentResponse = {
            id,
            userEmail,
            body,
            status: 'open',
            visibility: 'shared',
            createdAt,
          } as CommentResponse;
          expect(comment.replies).toBeUndefined();
        },
      ),
    );
  });
});
