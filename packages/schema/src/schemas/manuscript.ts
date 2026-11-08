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

export const AuthorPublicationSchema = z.object({
  title: z.string().min(1).max(500),
  authorName: z.string().max(255).default('Anonymous'),
  language: z.string().min(2).max(10).default('en'),
  identifier: z.string().max(255).optional(),
  description: z.string().max(5000).optional(),
  rights: z.string().max(500).optional(),
  chapters: z.array(ChapterDraftSchema).min(1).max(100),
});

export type AuthorPublication = z.infer<typeof AuthorPublicationSchema>;

export const SaveManuscriptDraftSchema = z.object({
  publication: AuthorPublicationSchema,
  expectedVersion: z.number().int().min(0).optional(),
});

export type SaveManuscriptDraft = z.infer<typeof SaveManuscriptDraftSchema>;

export const ManuscriptDraftResponseSchema = z.object({
  bookId: z.string(),
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

export type PublishManuscriptResponse = z.infer<typeof PublishManuscriptResponseSchema>;
