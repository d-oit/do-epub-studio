import { describe, expect, it } from 'vitest';
import { buildPortabilityEnvelope, stringifyPortabilityEnvelope } from './build';
import {
  analyzeImport,
  planImport,
  classifyAnchorQuality,
  buildReanchorReport,
  type ReadinessBookState,
} from './import';

const source = {
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
    {
      id: 'h-2',
      chapterRef: null,
      cfiRange: null,
      selectedText: 'short',
      note: null,
      color: '#ff0000',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  bookmarks: [
    {
      id: 'b-1',
      locator: {
        cfi: 'epubcfi(/6/4)',
        chapterRef: 'chapter.xhtml',
        selectedText: 'bookmark quote',
      },
      label: 'bookmark',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  comments: [],
  progress: {
    locator: { cfi: 'epubcfi(/6/4!/4/2:3)' },
    progressPercent: 42,
    updatedAt: '2026-11-19T00:00:00.000Z',
  },
};

async function buildEnvelopeText() {
  const envelope = await buildPortabilityEnvelope({ scope: 'book', publications: [source] });
  return stringifyPortabilityEnvelope(envelope);
}

const emptyCurrent: Record<string, ReadinessBookState | null> = {
  'book-1': { highlights: [], comments: [], bookmarks: [], progress: null },
};

describe('portability import analysis', () => {
  it('round-trips a built envelope into preview + plan', async () => {
    const text = await buildEnvelopeText();
    const preview = analyzeImport(text, emptyCurrent);
    expect(preview.summary.books).toBe(1);
    expect(preview.summary.totalAnnotations).toBe(3); // 2 highlights + 1 bookmark
    expect(preview.summary.newAnnotations).toBe(3);
    expect(preview.summary.duplicateAnnotations).toBe(0);
    expect(preview.publications[0]?.progressStatus).toBe('new');

    const plan = await planImport(preview);
    expect(plan.operations).toHaveLength(3); // 1 complete highlight + 1 bookmark + progress (orphan h-2 is not creatable via API)
    const progresses = plan.operations.filter((op) => op.kind === 'progress');
    expect(progresses).toHaveLength(1);
    const ids = plan.operations.map((op) => op.mutationId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('never mutates its inputs (non-mutating preview guarantee)', async () => {
    const text = await buildEnvelopeText();
    const snapshot = JSON.stringify(JSON.parse(text));
    analyzeImport(text, emptyCurrent);
    expect(JSON.stringify(JSON.parse(text))).toBe(snapshot);
  });

  it('detects duplicates against existing state and replans idempotently', async () => {
    const text = await buildEnvelopeText();
    const plan = await planImport(analyzeImport(text, emptyCurrent));
    const ops = plan.operations;
    expect(ops.length).toBe(3);

    const h0 = ops.find((o) => o.kind === 'highlight' && o.sourceId === 'h-1');
    const b0 = ops.find((o) => o.kind === 'bookmark');
    if (!h0 || !b0) throw new Error('expected import operations');

    // Simulate a completed import: all annotated entities now exist.
    const applied: ReadinessBookState = {
      highlights: [
        {
          id: h0.targetId,
          chapterRef: 'chapter.xhtml',
          cfiRange: 'epubcfi(/6/4!/4/2:3)',
          selectedText: 'A sufficiently long quoted passage for exact anchoring',
          note: 'note',
          color: '#ffff00',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-02T00:00:00.000Z',
        },
        {
          id: 'orphan-h-2',
          chapterRef: null,
          cfiRange: null,
          selectedText: '',
          note: null,
          color: '#ff0000',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      comments: [],
      bookmarks: [
        {
          id: b0.targetId,
          locator: {
            cfi: 'epubcfi(/6/4)',
            chapterRef: 'chapter.xhtml',
            selectedText: 'bookmark quote',
          },
          label: 'bookmark',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      progress: null,
    };

    const rePreview = analyzeImport(text, { 'book-1': applied });
    expect(rePreview.summary.duplicateAnnotations).toBe(3);
    expect(rePreview.summary.newAnnotations).toBe(0);

    const rePlan = await planImport(rePreview);
    // Idempotent re-import: no new entries remain (progress applies once).
    const nonProgress = rePlan.operations.filter((op) => op.kind !== 'progress');
    expect(nonProgress).toHaveLength(0);
  });

  it('rejects tampered/invalid envelopes', async () => {
    expect(() => analyzeImport('{', emptyCurrent)).toThrow(/Invalid JSON/);
    const bad = (await buildEnvelopeText()).replace(
      '"format":"do-epub-studio.portability"',
      '"format":"evil"',
    );
    expect(() => analyzeImport(bad, emptyCurrent)).toThrow();
  });

  it('classifies anchor quality and reports re-anchor counts', () => {
    expect(
      classifyAnchorQuality({
        cfi: 'epubcfi(/6/4!/4/2:3)',
        chapterRef: 'chapter.xhtml',
        selectedText: 'A sufficiently long quoted passage',
      }),
    ).toBe('exact');
    expect(
      classifyAnchorQuality({
        cfi: 'epubcfi(/6/4!/4/2:3)',
        chapterRef: 'chapter.xhtml',
        selectedText: 'short',
      }),
    ).toBe('weak');
    expect(
      classifyAnchorQuality({
        cfi: 'epubcfi(/6/4!/4/2:3)',
        chapterRef: null,
        selectedText: 'A sufficiently long quoted passage',
      }),
    ).toBe('weak');
    expect(
      classifyAnchorQuality({
        cfi: null,
        chapterRef: 'chapter.xhtml',
        selectedText: 'A sufficiently long quoted passage',
      }),
    ).toBe('unanchored');
    expect(
      classifyAnchorQuality({
        cfi: 'javascript:alert(1)',
        chapterRef: 'chapter.xhtml',
        selectedText: 'A sufficiently long quoted passage',
      }),
    ).toBe('unanchored');

    const report = buildReanchorReport([
      { kind: 'highlight', sourceId: 'a', targetId: '', anchorQuality: 'exact', status: 'new' },
      { kind: 'highlight', sourceId: 'b', targetId: '', anchorQuality: 'weak', status: 'new' },
      { kind: 'bookmark', sourceId: 'c', targetId: '', anchorQuality: 'unanchored', status: 'new' },
    ]);
    expect(report).toEqual({ exact: 1, weak: 1, unanchored: 1 });
  });

  it('derives stable mutation ids for idempotency', async () => {
    const text = await buildEnvelopeText();
    const planA = await planImport(analyzeImport(text, emptyCurrent));
    const planB = await planImport(analyzeImport(text, emptyCurrent));
    expect(planA.operations.map((o) => o.mutationId)).toEqual(
      planB.operations.map((o) => o.mutationId),
    );
  });

  it('reports archive books absent from the library as skipped, never writes them', async () => {
    const envelope = await buildPortabilityEnvelope({
      scope: 'account',
      publications: [
        source,
        { ...source, bookId: 'book-missing', slug: 'gone', title: 'Gone Book' },
      ],
    });
    const preview = analyzeImport(stringifyPortabilityEnvelope(envelope), emptyCurrent);

    expect(preview.summary.skippedBooks).toBe(1);
    expect(preview.missingBooks).toEqual([{ bookId: 'book-missing', title: 'Gone Book' }]);
    expect(preview.publications.map((p) => p.bookId)).toEqual(['book-1']);
    expect(preview.summary.books).toBe(1);

    const plan = await planImport(preview);
    expect(plan.operations.every((op) => op.bookId !== 'book-missing')).toBe(true);
  });

  it('uses the current progress revision as baseRevision for updates', async () => {
    const text = await buildEnvelopeText();
    const current: ReadinessBookState = {
      highlights: [],
      comments: [],
      bookmarks: [],
      progress: {
        locator: { cfi: 'epubcfi(/6/4!/4/2:3)' },
        progressPercent: 40,
        updatedAt: '2026-11-18T00:00:00.000Z',
        revision: 4,
      },
    };
    const preview = analyzeImport(text, { 'book-1': current });
    expect(preview.publications[0]?.progressStatus).toBe('update');
    expect(preview.publications[0]?.currentProgressRevision).toBe(4);

    const plan = await planImport(preview);
    const progressOp = plan.operations.find((op) => op.kind === 'progress');
    expect(progressOp?.payload.baseRevision).toBe(4);
  });

  it('uses baseRevision 0 when the book has no progress yet', async () => {
    const text = await buildEnvelopeText();
    const plan = await planImport(analyzeImport(text, emptyCurrent));
    const progressOp = plan.operations.find((op) => op.kind === 'progress');
    expect(progressOp?.payload.baseRevision).toBe(0);
  });
});
