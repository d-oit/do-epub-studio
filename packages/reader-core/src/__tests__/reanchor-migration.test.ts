import { describe, expect, it } from 'vitest';
import {
  migrateAnnotationAnchor,
  migrateAnnotations,
  type MigrationCandidate,
  type ChapterContentItem,
} from '../reanchor-migration';

describe('migrateAnnotationAnchor', () => {
  const chapters: ChapterContentItem[] = [
    {
      chapterRef: 'chapter1.xhtml',
      content:
        '<html><body><h1>Chapter 1</h1><p>The quick brown fox jumps over the lazy dog in the field.</p></body></html>',
    },
    {
      chapterRef: 'chapter2.xhtml',
      content:
        '<html><body><h1>Chapter 2</h1><p>A second passage contains unique content about constellations and stars.</p></body></html>',
    },
    {
      chapterRef: 'chapter3.xhtml',
      content:
        '<html><body><h1>Chapter 3</h1><p>Repeated phrase appears here. And another repeated phrase appears here too.</p></body></html>',
    },
  ];

  it('preserves prior anchor metadata and re-anchors moved text in same chapter', () => {
    const candidate: MigrationCandidate = {
      id: 'hl-1',
      chapterRef: 'chapter1.xhtml',
      cfiRange: 'epubcfi(/6/2!/4/2:10,/4/2:30)',
      selectedText: 'quick brown fox jumps',
    };

    const decision = migrateAnnotationAnchor(candidate, chapters, 'rev-2');

    expect(decision.annotationId).toBe('hl-1');
    expect(decision.anchorStatus).toBe('anchored');
    expect(decision.confidence).toBeGreaterThanOrEqual(0.95);
    expect(decision.migrationOutcome).toBe('exact_match');
    expect(decision.chapterRef).toBe('chapter1.xhtml');
    expect(decision.originalCfi).toBe('epubcfi(/6/2!/4/2:10,/4/2:30)');
    expect(decision.originalChapterRef).toBe('chapter1.xhtml');
    expect(decision.originalSelectedText).toBe('quick brown fox jumps');
    expect(decision.targetRevisionId).toBe('rev-2');
  });

  it('re-anchors moved text that relocated to a different chapter', () => {
    const candidate: MigrationCandidate = {
      id: 'hl-2',
      chapterRef: 'chapter1.xhtml', // Originally thought to be in chapter 1
      cfiRange: 'epubcfi(/6/2!/4/2)',
      selectedText: 'constellations and stars',
    };

    const decision = migrateAnnotationAnchor(candidate, chapters, 'rev-2');

    expect(decision.anchorStatus).toBe('migrated');
    expect(decision.confidence).toBeGreaterThanOrEqual(0.85);
    expect(decision.migrationOutcome).toBe('moved_text');
    expect(decision.chapterRef).toBe('chapter2.xhtml');
    expect(decision.originalChapterRef).toBe('chapter1.xhtml');
    expect(decision.cfiRange).toBeNull(); // Old CFI invalid in new chapter
  });

  it('marks deleted text as orphaned with 0 confidence while preserving original quote', () => {
    const candidate: MigrationCandidate = {
      id: 'hl-deleted',
      chapterRef: 'chapter1.xhtml',
      cfiRange: 'epubcfi(/6/2!/4/2:5,/4/2:20)',
      selectedText: 'completely removed section from author manuscript',
    };

    const decision = migrateAnnotationAnchor(candidate, chapters, 'rev-2');

    expect(decision.anchorStatus).toBe('orphaned');
    expect(decision.confidence).toBe(0.0);
    expect(decision.migrationOutcome).toBe('deleted_text');
    expect(decision.originalSelectedText).toBe('completely removed section from author manuscript');
    expect(decision.originalCfi).toBe('epubcfi(/6/2!/4/2:5,/4/2:20)');
  });

  it('flags ambiguous text with multiple matches as needs_review without silent false anchoring', () => {
    const candidate: MigrationCandidate = {
      id: 'cm-ambiguous',
      chapterRef: 'chapter3.xhtml',
      cfiRange: 'epubcfi(/6/6!/4/2)',
      selectedText: 'repeated phrase',
    };

    const decision = migrateAnnotationAnchor(candidate, chapters, 'rev-2');

    expect(decision.anchorStatus).toBe('needs_review');
    expect(decision.confidence).toBeLessThan(0.7);
    expect(decision.migrationOutcome).toBe('ambiguous_match');
  });

  it('disambiguates multiple matches using prefix and suffix context', () => {
    const candidate: MigrationCandidate = {
      id: 'cm-disambiguated',
      chapterRef: 'chapter3.xhtml',
      cfiRange: 'epubcfi(/6/6!/4/2)',
      selectedText: 'repeated phrase',
      prefix: 'And another',
      suffix: 'appears here too',
    };

    const decision = migrateAnnotationAnchor(candidate, chapters, 'rev-2');

    expect(decision.anchorStatus).toBe('migrated');
    expect(decision.confidence).toBeGreaterThanOrEqual(0.85);
    expect(decision.migrationOutcome).toBe('moved_text');
    expect(decision.chapterRef).toBe('chapter3.xhtml');
  });

  it('migrates chapter-level comment without selectedText when chapter exists', () => {
    const candidate: MigrationCandidate = {
      id: 'cm-root',
      chapterRef: 'chapter2.xhtml',
      selectedText: null,
    };

    const decision = migrateAnnotationAnchor(candidate, chapters, 'rev-2');

    expect(decision.anchorStatus).toBe('anchored');
    expect(decision.migrationOutcome).toBe('exact_match');
    expect(decision.chapterRef).toBe('chapter2.xhtml');
  });

  it('orphans chapter-level comment when chapter was deleted', () => {
    const candidate: MigrationCandidate = {
      id: 'cm-lost-chapter',
      chapterRef: 'deleted-chapter.xhtml',
      selectedText: null,
    };

    const decision = migrateAnnotationAnchor(candidate, chapters, 'rev-2');

    expect(decision.anchorStatus).toBe('orphaned');
    expect(decision.confidence).toBe(0.0);
    expect(decision.migrationOutcome).toBe('deleted_text');
  });

  it('is idempotent and resumable when already migrated to target revision', () => {
    const candidate: MigrationCandidate = {
      id: 'hl-already',
      revisionId: 'rev-2', // Already target revision
      chapterRef: 'chapter2.xhtml',
      selectedText: 'constellations and stars',
      originalChapterRef: 'chapter1.xhtml',
      originalSelectedText: 'constellations and stars',
    };

    const decision = migrateAnnotationAnchor(candidate, chapters, 'rev-2');

    expect(decision.migrationOutcome).toBe('already_migrated');
    expect(decision.anchorStatus).toBe('migrated');
    expect(decision.confidence).toBe(1.0);
    expect(decision.chapterRef).toBe('chapter2.xhtml');
    expect(decision.originalChapterRef).toBe('chapter1.xhtml');
  });
});

describe('migrateAnnotations', () => {
  const chapters: ChapterContentItem[] = [
    { chapterRef: 'ch1.xhtml', content: 'First chapter text here with target.' },
    { chapterRef: 'ch2.xhtml', content: 'Second chapter text has moved passage.' },
  ];

  it('produces an aggregate migration report with accurate counts and outcomes', () => {
    const candidates: MigrationCandidate[] = [
      { id: '1', chapterRef: 'ch1.xhtml', selectedText: 'chapter text here' },
      { id: '2', chapterRef: 'ch1.xhtml', selectedText: 'moved passage' },
      { id: '3', chapterRef: 'ch1.xhtml', selectedText: 'deleted from revision entirely' },
    ];

    const report = migrateAnnotations(candidates, chapters, 'rev-99');

    expect(report.totalCount).toBe(3);
    expect(report.migratedCount).toBe(2);
    expect(report.orphanedCount).toBe(1);
    expect(report.needsReviewCount).toBe(0);
    expect(report.outcomes).toEqual({
      exact_match: 1,
      moved_text: 1,
      ambiguous_match: 0,
      deleted_text: 1,
      already_migrated: 0,
    });
    expect(report.decisions).toHaveLength(3);
  });
});
