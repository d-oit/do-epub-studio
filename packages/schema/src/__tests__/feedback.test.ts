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
  ReferenceCreateSchema,
  ReferenceVerifySchema,
  ReferenceListQuerySchema,
  StyleProfileSchema,
  AnchorStateSchema,
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

// ── Wave 3 (COL-03): references, style, anchor states ────────────────────

describe('ReferenceCreateSchema', () => {
  const base = { kind: 'glossary_term', content: 'term', origin: 'creator' };

  it('accepts a creator-origin reference', () => {
    expect(ReferenceCreateSchema.safeParse(base).success).toBe(true);
  });

  it('accepts an external citation with a sourceUrl', () => {
    const result = ReferenceCreateSchema.safeParse({
      kind: 'external_citation',
      content: 'c',
      origin: 'external',
      sourceUrl: 'https://example.com/a',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an external citation without a sourceUrl', () => {
    const result = ReferenceCreateSchema.safeParse({
      kind: 'external_citation',
      content: 'c',
      origin: 'external',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-external reference carrying a sourceUrl', () => {
    const result = ReferenceCreateSchema.safeParse({
      ...base,
      sourceUrl: 'https://example.com/a',
    });
    expect(result.success).toBe(false);
  });

  it('rejects unknown kinds and empty content', () => {
    expect(ReferenceCreateSchema.safeParse({ ...base, kind: 'footnote' }).success).toBe(false);
    expect(ReferenceCreateSchema.safeParse({ ...base, content: '' }).success).toBe(false);
  });

  it('bounds title and content lengths', () => {
    expect(ReferenceCreateSchema.safeParse({ ...base, title: 'a'.repeat(255) }).success).toBe(true);
    expect(ReferenceCreateSchema.safeParse({ ...base, title: 'a'.repeat(256) }).success).toBe(false);
    expect(ReferenceCreateSchema.safeParse({ ...base, content: 'a'.repeat(5001) }).success).toBe(false);
  });
});

describe('ReferenceVerifySchema', () => {
  it('requires a non-empty evidence note', () => {
    expect(ReferenceVerifySchema.safeParse({ verified: true, evidenceNote: '' }).success).toBe(false);
    expect(ReferenceVerifySchema.safeParse({ verified: true, evidenceNote: 'archive 1889' }).success).toBe(true);
    expect(ReferenceVerifySchema.safeParse({ verified: false, evidenceNote: 'disputed' }).success).toBe(true);
  });
});

describe('ReferenceListQuerySchema', () => {
  it('defaults limit and accepts a kind filter', () => {
    const parsed = ReferenceListQuerySchema.parse({});
    expect(parsed.limit).toBe(200);
    expect(parsed.kind).toBeUndefined();
    expect(ReferenceListQuerySchema.safeParse({ kind: 'style_excerpt' }).success).toBe(true);
  });

  it('rejects over-large limits and unknown kinds', () => {
    expect(ReferenceListQuerySchema.safeParse({ limit: 201 }).success).toBe(false);
    expect(ReferenceListQuerySchema.safeParse({ kind: 'chapter_note' }).success).toBe(false);
  });
});

describe('StyleProfileSchema', () => {
  it('accepts draft and approved statuses', () => {
    expect(StyleProfileSchema.safeParse({ status: 'draft' }).success).toBe(true);
    expect(StyleProfileSchema.safeParse({ status: 'approved', language: 'en' }).success).toBe(true);
  });

  it('rejects an unknown status', () => {
    expect(StyleProfileSchema.safeParse({ status: 'reviewed' }).success).toBe(false);
  });

  it('bounds free-text fields', () => {
    expect(StyleProfileSchema.safeParse({ status: 'draft', terminology: 'a'.repeat(5000) }).success).toBe(true);
    expect(StyleProfileSchema.safeParse({ status: 'draft', terminology: 'a'.repeat(5001) }).success).toBe(false);
  });
});

describe('AnchorStateSchema', () => {
  it('accepts exactly the three honest states', () => {
    for (const state of ['unresolved', 'resolved', 'source_changed']) {
      expect(AnchorStateSchema.safeParse(state).success).toBe(true);
    }
    expect(AnchorStateSchema.safeParse('guessed').success).toBe(false);
  });
});

describe('FeedbackCreateSchema reference pins', () => {
  const base = {
    kind: 'comment',
    category: 'general',
    body: 'x',
    anchor: { selectedText: 'x' },
    mutationId: '11111111-1111-4111-8111-111111111111',
  };

  it('accepts referenceRevisions pins', () => {
    const result = FeedbackCreateSchema.safeParse({
      ...base,
      referenceRevisions: { 'ref-1': 2 },
    });
    expect(result.success).toBe(true);
  });

  it('rejects non-positive revisions', () => {
    expect(FeedbackCreateSchema.safeParse({
      ...base,
      referenceRevisions: { 'ref-1': 0 },
    }).success).toBe(false);
  });
});
