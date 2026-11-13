import { describe, expect, it } from 'vitest';
import { AuthorPublicationSchema, SaveManuscriptDraftSchema } from '../schemas';

const basePublication = {
  title: '  A Test Publication  ',
  chapters: [
    {
      id: 'chapter-1',
      title: 'Introduction',
      order: 0,
      contentHtml: '<p>Introduction</p>',
    },
  ],
};

describe('AuthorPublicationSchema', () => {
  it('applies publication defaults and trims the title', () => {
    const result = AuthorPublicationSchema.parse(basePublication);

    expect(result.title).toBe('A Test Publication');
    expect(result.creators).toEqual(['Anonymous']);
    expect(result.language).toBe('en');
    expect(result.stylesheetAssetIds).toEqual([]);
  });

  it('rejects duplicate chapter ids, chapter orders, and stylesheet assets', () => {
    const chapter = basePublication.chapters[0];
    const result = AuthorPublicationSchema.safeParse({
      ...basePublication,
      chapters: [chapter, { ...chapter, title: 'Repeated chapter' }],
      stylesheetAssetIds: [
        '550e8400-e29b-41d4-a716-446655440000',
        '550e8400-e29b-41d4-a716-446655440000',
      ],
    });

    expect(result.success).toBe(false);
    const issuePaths = result.success
      ? []
      : result.error.issues.map((issue) => issue.path.join('.'));
    expect(issuePaths).toEqual(
      expect.arrayContaining(['chapters.1.id', 'chapters.1.order', 'stylesheetAssetIds']),
    );
  });
});
describe('SaveManuscriptDraftSchema', () => {
  it('requires a positive integer expectedVersion', () => {
    expect(
      SaveManuscriptDraftSchema.safeParse({ publication: basePublication, expectedVersion: 1 })
        .success,
    ).toBe(true);
    expect(SaveManuscriptDraftSchema.safeParse({ publication: basePublication }).success).toBe(
      false,
    );
    expect(
      SaveManuscriptDraftSchema.safeParse({ publication: basePublication, expectedVersion: 0 })
        .success,
    ).toBe(false);
    expect(
      SaveManuscriptDraftSchema.safeParse({ publication: basePublication, expectedVersion: 1.5 })
        .success,
    ).toBe(false);
  });
});
