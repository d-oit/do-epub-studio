import { describe, it, expect } from 'vitest';
import {
  FeedbackKindSchema,
  FeedbackCategorySchema,
  FeedbackStatusSchema,
  FeedbackDispositionSchema,
  FeedbackAnchorSchema,
  FeedbackCreateSchema,
  FeedbackReplySchema,
  FeedbackExportSchema,
  CreatorAssignSchema,
  FeedbackListQuerySchema,
} from '../schemas/feedback';

describe('FeedbackKindSchema', () => {
  it('accepts known kinds', () => {
    expect(FeedbackKindSchema.safeParse('comment').success).toBe(true);
    expect(FeedbackKindSchema.safeParse('suggestion').success).toBe(true);
  });

  it('rejects unknown kinds', () => {
    expect(FeedbackKindSchema.safeParse('rewrite').success).toBe(false);
  });
});

describe('FeedbackCategorySchema', () => {
  it('accepts all six categories', () => {
    for (const category of ['general', 'grammar', 'spelling', 'story', 'logic', 'style']) {
      expect(FeedbackCategorySchema.safeParse(category).success).toBe(true);
    }
  });

  it('rejects unknown categories', () => {
    expect(FeedbackCategorySchema.safeParse('tone').success).toBe(false);
  });
});

describe('FeedbackStatusSchema', () => {
  it('accepts lifecycle statuses', () => {
    for (const status of ['open', 'accepted', 'declined', 'resolved', 'withdrawn']) {
      expect(FeedbackStatusSchema.safeParse(status).success).toBe(true);
    }
  });

  it('rejects unknown statuses', () => {
    expect(FeedbackStatusSchema.safeParse('deleted').success).toBe(false);
  });
});

describe('FeedbackDispositionSchema', () => {
  it('accepts dispositions including reopen', () => {
    for (const disposition of ['accepted', 'declined', 'resolved', 'open']) {
      expect(FeedbackDispositionSchema.safeParse(disposition).success).toBe(true);
    }
  });
});

describe('FeedbackAnchorSchema', () => {
  it('requires selectedText', () => {
    expect(FeedbackAnchorSchema.safeParse({ selectedText: 'x' }).success).toBe(true);
    expect(FeedbackAnchorSchema.safeParse({}).success).toBe(false);
  });

  it('bounds selectedText at 5000 chars', () => {
    expect(FeedbackAnchorSchema.safeParse({ selectedText: 'a'.repeat(5000) }).success).toBe(true);
    expect(FeedbackAnchorSchema.safeParse({ selectedText: 'a'.repeat(5001) }).success).toBe(false);
  });

  it('validates bookFileId as uuid', () => {
    expect(FeedbackAnchorSchema.safeParse({ selectedText: 'x', bookFileId: 'nope' }).success).toBe(false);
  });
});

describe('FeedbackCreateSchema', () => {
  const base = {
    kind: 'comment',
    category: 'general',
    body: 'x',
    anchor: { selectedText: 'x' },
    mutationId: '11111111-1111-4111-8111-111111111111',
  };

  it('accepts a valid comment', () => {
    expect(FeedbackCreateSchema.safeParse(base).success).toBe(true);
  });

  it('requires proposedText for suggestions', () => {
    const result = FeedbackCreateSchema.safeParse({ ...base, kind: 'suggestion' });
    expect(result.success).toBe(false);
  });

  it('accepts a suggestion with proposedText', () => {
    expect(FeedbackCreateSchema.safeParse({ ...base, kind: 'suggestion', proposedText: 'y' }).success).toBe(true);
  });

  it('rejects an empty body', () => {
    expect(FeedbackCreateSchema.safeParse({ ...base, body: '' }).success).toBe(false);
  });

  it('rejects a non-uuid mutationId', () => {
    expect(FeedbackCreateSchema.safeParse({ ...base, mutationId: 'abc' }).success).toBe(false);
  });
});

describe('FeedbackReplySchema', () => {
  it('rejects empty bodies', () => {
    expect(FeedbackReplySchema.safeParse({ body: '' }).success).toBe(false);
    expect(FeedbackReplySchema.safeParse({ body: 'x' }).success).toBe(true);
  });
});

describe('FeedbackExportSchema', () => {
  it('bounds ids at 1..200', () => {
    expect(FeedbackExportSchema.safeParse({ ids: [] }).success).toBe(false);
    expect(FeedbackExportSchema.safeParse({ ids: ['11111111-1111-4111-8111-111111111111'] }).success).toBe(true);
    expect(FeedbackExportSchema.safeParse({ ids: Array.from({ length: 201 }, () => '11111111-1111-4111-8111-111111111111') }).success).toBe(false);
  });
});

describe('CreatorAssignSchema', () => {
  it('requires a valid email', () => {
    expect(CreatorAssignSchema.safeParse({ email: 'a@b.co' }).success).toBe(true);
    expect(CreatorAssignSchema.safeParse({ email: 'nope' }).success).toBe(false);
  });
});

describe('FeedbackListQuerySchema', () => {
  it('defaults limit/offset', () => {
    const result = FeedbackListQuerySchema.parse({});
    expect(result.limit).toBe(100);
    expect(result.offset).toBe(0);
  });

  it('clamps limit at 200 and rejects negatives', () => {
    expect(FeedbackListQuerySchema.safeParse({ limit: 201 }).success).toBe(false);
    expect(FeedbackListQuerySchema.safeParse({ offset: -1 }).success).toBe(false);
  });
});
