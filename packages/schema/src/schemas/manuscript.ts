import { z } from 'zod';

export const ChapterDraftSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9_-]+$/, {
      message: 'Chapter id must be alphanumeric with dashes or underscores',
    }),
  title: z.string().min(1).max(255),
  order: z.number().int().min(0),
  contentHtml: z.string().max(500_000),
});

export type ChapterDraft = z.infer<typeof ChapterDraftSchema>;

export const AuthorPublicationSchema = z
  .object({
    title: z.string().trim().min(1).max(500),
    creators: z.array(z.string().trim().min(1).max(255)).min(1).max(20).default(['Anonymous']),
    language: z.string().min(2).max(10).default('en'),
    identifier: z.string().trim().min(1).max(255).optional(),
    description: z.string().max(5000).optional(),
    publisher: z.string().max(255).optional(),
    rights: z.string().max(500).optional(),
    coverImageAssetId: z.string().uuid().nullable().optional(),
    stylesheetAssetIds: z.array(z.string().uuid()).max(20).default([]),
    chapters: z.array(ChapterDraftSchema).min(1).max(100),
  })
  .superRefine((publication, ctx) => {
    const chapterIds = new Set<string>();
    const chapterOrders = new Set<number>();
    publication.chapters.forEach((chapter, index) => {
      if (chapterIds.has(chapter.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['chapters', index, 'id'],
          message: 'Chapter IDs must be unique',
        });
      }
      if (chapterOrders.has(chapter.order)) {
        ctx.addIssue({
          code: 'custom',
          path: ['chapters', index, 'order'],
          message: 'Chapter order values must be unique',
        });
      }
      chapterIds.add(chapter.id);
      chapterOrders.add(chapter.order);
    });

    if (new Set(publication.stylesheetAssetIds).size !== publication.stylesheetAssetIds.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['stylesheetAssetIds'],
        message: 'Stylesheet asset IDs must be unique',
      });
    }
  });

export type AuthorPublication = z.infer<typeof AuthorPublicationSchema>;

export const SaveManuscriptDraftSchema = z.object({
  publication: AuthorPublicationSchema,
  expectedVersion: z.number().int().min(1),
});

export type SaveManuscriptDraft = z.infer<typeof SaveManuscriptDraftSchema>;

export const ManuscriptDraftResponseSchema = z.object({
  bookId: z.string(),
  bookSlug: z.string(),
  publication: AuthorPublicationSchema,
  draftVersion: z.number().int().min(1),
  updatedAt: z.string(),
});

export type ManuscriptDraftResponse = z.infer<typeof ManuscriptDraftResponseSchema>;

export const PublishManuscriptResponseSchema = z.object({
  bookId: z.string(),
  fileId: z.string(),
  revision: z.number().int().min(1),
  sha256: z.string().length(64),
  fileSize: z.number().int().min(0),
  status: z.string(),
});
export const MAX_AUTHOR_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_AUTHOR_STYLESHEET_BYTES = 64 * 1024;
export const MAX_AUTHOR_ASSETS_TOTAL_BYTES = 10 * 1024 * 1024;
export const MAX_AUTHOR_ASSET_COUNT = 50;

export const AuthorAssetMetadataSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(120),
  mediaType: z.enum(['image/jpeg', 'image/png', 'image/gif', 'text/css']),
  sizeBytes: z.number().int().positive().max(MAX_AUTHOR_IMAGE_BYTES),
  sha256: z
    .string()
    .length(64)
    .regex(/^[0-9a-f]{64}$/i),
  createdAt: z.string().datetime(),
});

export type AuthorAssetMetadata = z.infer<typeof AuthorAssetMetadataSchema>;

export type PublishManuscriptResponse = z.infer<typeof PublishManuscriptResponseSchema>;
