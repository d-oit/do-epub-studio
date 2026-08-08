import { describe, it, expect } from 'vitest';
import {
  mapOfflineHighlight,
  mapOfflineComment,
  mapOfflineBookmark,
} from './mapOfflineAnnotation';
import type { AnnotationEntry } from '../../../lib/offline';

const base: AnnotationEntry = {
  id: 'a1',
  bookId: 'book1',
  type: 'highlight',
  cfi: 'epubcfi(/6/4[ch1]!/4/2)',
  text: 'selected text',
  comment: 'a note',
  color: 'blue',
  chapter: 'ch1',
  createdAt: 1700000000000,
  synced: true,
  mutationId: 'm1',
};

describe('mapOfflineHighlight', () => {
  it('maps all fields correctly', () => {
    const result = mapOfflineHighlight(base);
    expect(result).toEqual({
      id: 'a1',
      chapterRef: 'ch1',
      cfiRange: 'epubcfi(/6/4[ch1]!/4/2)',
      selectedText: 'selected text',
      note: 'a note',
      color: 'blue',
      createdAt: new Date(1700000000000).toISOString(),
      updatedAt: new Date(1700000000000).toISOString(),
    });
  });

  it('defaults missing optional fields', () => {
    const minimal: AnnotationEntry = { ...base, text: undefined, comment: undefined, color: undefined, chapter: undefined };
    const result = mapOfflineHighlight(minimal);
    expect(result.selectedText).toBe('');
    expect(result.note).toBeNull();
    expect(result.color).toBe('yellow');
    expect(result.chapterRef).toBeNull();
  });
});

describe('mapOfflineComment', () => {
  it('maps all fields correctly', () => {
    const entry: AnnotationEntry = { ...base, type: 'comment', text: 'context', comment: 'body text' };
    const result = mapOfflineComment(entry);
    expect(result).toEqual({
      id: 'a1',
      userEmail: '',
      chapterRef: 'ch1',
      cfiRange: 'epubcfi(/6/4[ch1]!/4/2)',
      selectedText: 'context',
      body: 'body text',
      status: 'open',
      visibility: 'shared',
      parentCommentId: null,
      createdAt: new Date(1700000000000).toISOString(),
      updatedAt: new Date(1700000000000).toISOString(),
      resolvedAt: null,
    });
  });

  it('defaults missing optional fields', () => {
    const minimal: AnnotationEntry = { ...base, type: 'comment', text: undefined, comment: undefined, chapter: undefined };
    const result = mapOfflineComment(minimal);
    expect(result.selectedText).toBeNull();
    expect(result.body).toBe('');
    expect(result.chapterRef).toBeNull();
  });

  it('uses stored status when present (Plan 998)', () => {
    const entry: AnnotationEntry = {
      ...base,
      type: 'comment',
      comment: 'resolved offline',
      status: 'resolved',
      visibility: 'shared',
    };
    const result = mapOfflineComment(entry);
    expect(result.status).toBe('resolved');
    expect(result.visibility).toBe('shared');
    expect(result.resolvedAt).toBe(new Date(1700000000000).toISOString());
  });

  it('falls back to open/shared for legacy entries without status (Plan 998)', () => {
    const legacy: AnnotationEntry = { ...base, type: 'comment', comment: 'legacy entry' };
    delete legacy.status;
    delete legacy.visibility;
    const result = mapOfflineComment(legacy);
    expect(result.status).toBe('open');
    expect(result.visibility).toBe('shared');
    expect(result.resolvedAt).toBeNull();
  });

  it('maps internal visibility when stored (Plan 998)', () => {
    const entry: AnnotationEntry = {
      ...base,
      type: 'comment',
      comment: 'internal note',
      status: 'open',
      visibility: 'internal',
    };
    const result = mapOfflineComment(entry);
    expect(result.visibility).toBe('internal');
    expect(result.status).toBe('open');
    expect(result.resolvedAt).toBeNull();
  });
});

describe('mapOfflineBookmark', () => {
  it('maps all fields correctly', () => {
    const entry: AnnotationEntry = { ...base, type: 'bookmark', text: 'Chapter 1' };
    const result = mapOfflineBookmark(entry);
    expect(result).toEqual({
      id: 'a1',
      locator: { cfi: 'epubcfi(/6/4[ch1]!/4/2)' },
      label: 'Chapter 1',
      createdAt: new Date(1700000000000).toISOString(),
    });
  });

  it('defaults missing label', () => {
    const entry: AnnotationEntry = { ...base, type: 'bookmark', text: undefined };
    const result = mapOfflineBookmark(entry);
    expect(result.label).toBe('');
  });
});
