import { describe, expect, it } from 'vitest';
import {
  buildPortabilityEnvelope,
  stringifyPortabilityEnvelope,
  type PublicationExportSource,
} from './build';

const source: PublicationExportSource = {
  bookId: 'book-1',
  slug: 'my-book',
  title: 'My Book',
  highlights: [
    {
      id: 'h-1',
      chapterRef: 'chapter.xhtml',
      cfiRange: 'epubcfi(/6/4!/4/2:3)',
      selectedText: 'A sufficiently long quoted passage for exact anchoring',
      note: 'note',
      color: '#ffff00',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    },
  ],
  bookmarks: [],
  comments: [],
  progress: {
    locator: { cfi: 'epubcfi(/6/4!/4/2:3)' },
    progressPercent: 42,
    updatedAt: '2026-11-19T00:00:00.000Z',
  },
};

const preferences = {
  theme: 'dark' as const,
  fontFamily: 'serif' as const,
  fontSize: 'medium' as const,
  lineHeight: 2 as const,
  pageWidth: 'normal' as const,
  direction: 'default' as const,
  writingMode: 'horizontal-tb' as const,
  aiEnabled: false,
};

describe('portability export determinism', () => {
  it('produces byte-identical archives for identical input at the same exportedAt', async () => {
    const a = stringifyPortabilityEnvelope(
      await buildPortabilityEnvelope({
        scope: 'account',
        publications: [source],
        preferences,
        exportedAt: '2026-11-20T00:00:00.000Z',
      }),
    );
    const b = stringifyPortabilityEnvelope(
      await buildPortabilityEnvelope({
        scope: 'account',
        publications: [source],
        preferences,
        exportedAt: '2026-11-20T00:00:00.000Z',
      }),
    );
    expect(a).toBe(b);
  });

  it('derives stable ids from content rather than randomness', async () => {
    const first = await buildPortabilityEnvelope({
      scope: 'account',
      publications: [source],
      preferences,
      exportedAt: '2026-11-20T00:00:00.000Z',
    });
    const second = await buildPortabilityEnvelope({
      scope: 'account',
      publications: [source],
      preferences,
      exportedAt: '2026-11-20T00:00:00.000Z',
    });
    expect(second.id).toBe(first.id);
    expect(second.idempotencyKey).toBe(first.idempotencyKey);
    const pubA = first.items.find((i) => i.type === 'publication');
    const pubB = second.items.find((i) => i.type === 'publication');
    expect(pubA?.id).toBe(pubB?.id);
    // Item ids are unique within an envelope.
    expect(new Set(first.items.map((i) => i.id)).size).toBe(first.items.length);
  });

  it('reflects exportedAt in the envelope id, so different export times differ only there', async () => {
    const t1 = await buildPortabilityEnvelope({
      scope: 'account',
      publications: [source],
      exportedAt: '2026-11-20T00:00:00.000Z',
    });
    const t2 = await buildPortabilityEnvelope({
      scope: 'account',
      publications: [source],
      exportedAt: '2026-11-21T00:00:00.000Z',
    });
    expect(t1.id).not.toBe(t2.id);
    // Everything else (items, scope, app) stays identical.
    expect(JSON.stringify(t1.items)).toBe(JSON.stringify(t2.items));
  });
});
