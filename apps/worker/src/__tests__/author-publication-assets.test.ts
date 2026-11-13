import { describe, expect, it } from 'vitest';
import { AuthorPublicationSchema, MAX_AUTHOR_ASSET_COUNT } from '@do-epub-studio/shared';
import {
  isValidAuthorAssetId,
  publicationAssetRequirements,
} from '../lib/author-publication-assets';

const VALID_ASSET_ID = '550e8400-e29b-41d4-a716-446655440000';

function makePublication(contentHtml = '', changes: Record<string, unknown> = {}) {
  return AuthorPublicationSchema.parse({
    title: 'Asset boundary test',
    chapters: [{ id: 'chapter-1', title: 'Chapter 1', order: 0, contentHtml }],
    ...changes,
  });
}

describe('author publication asset requirements', () => {
  it('caps distinct assets referenced by chapter content', () => {
    const imageMarkup = Array.from({ length: MAX_AUTHOR_ASSET_COUNT + 1 }, (_, index) => {
      const suffix = index.toString(16).padStart(12, '0');
      return `<img src="asset:00000000-0000-4000-8000-${suffix}" alt="Figure">`;
    }).join('');

    expect(() => publicationAssetRequirements(makePublication(imageMarkup))).toThrow(/at most/i);
  });

  it('rejects one asset used as both image and stylesheet', () => {
    expect(() =>
      publicationAssetRequirements(
        makePublication('', {
          coverImageAssetId: VALID_ASSET_ID,
          stylesheetAssetIds: [VALID_ASSET_ID],
        }),
      ),
    ).toThrow(/both an image and a stylesheet/i);
  });

  it('validates the complete UUID path segment without regex backtracking', () => {
    expect(isValidAuthorAssetId(VALID_ASSET_ID)).toBe(true);
    expect(isValidAuthorAssetId(VALID_ASSET_ID.toUpperCase())).toBe(true);
    expect(isValidAuthorAssetId('../' + VALID_ASSET_ID)).toBe(false);
    expect(isValidAuthorAssetId('550e8400-e29b-41d4-c716-446655440000')).toBe(false);
    expect(isValidAuthorAssetId('550e8400-e29b-41d4-a716-44665544000')).toBe(false);
  });
});
