import { z } from 'zod';
import {
  MultiSignalLocatorSchema,
  CommentStatusSchema,
  CommentVisibilitySchema,
} from './common';

export const ProgressLocatorSchema = z.object({
  cfi: z.string().min(1).max(2048),
  selectedText: z.string().max(10000).optional(),
  chapterRef: z.string().max(1024).optional(),
});

export type ProgressLocator = z.infer<typeof ProgressLocatorSchema>;

export const ProgressUpdateSchema = z.object({
  locator: ProgressLocatorSchema,
  progressPercent: z.number().min(0).max(100),
});

export type ProgressUpdate = z.infer<typeof ProgressUpdateSchema>;

export const BookmarkCreateSchema = z.object({
  locator: MultiSignalLocatorSchema,
  label: z.string().max(255).optional(),
});

export type BookmarkCreate = z.infer<typeof BookmarkCreateSchema>;

export const HighlightCreateSchema = z.object({
  locator: MultiSignalLocatorSchema,
  note: z.string().max(5000).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .default('#ffff00'),
});

export type HighlightCreate = z.infer<typeof HighlightCreateSchema>;

export const HighlightUpdateSchema = HighlightCreateSchema.pick({ note: true, color: true }).partial();

export type HighlightUpdate = z.infer<typeof HighlightUpdateSchema>;

export const CommentCreateSchema = z.object({
  locator: MultiSignalLocatorSchema.optional(),
  body: z.string().min(1).max(10000),
  visibility: CommentVisibilitySchema.default('shared'),
  parentCommentId: z.string().uuid().optional(),
});

export type CommentCreate = z.infer<typeof CommentCreateSchema>;

export const CommentUpdateSchema = z.object({
  body: z.string().min(1).max(10000).optional(),
  status: CommentStatusSchema.optional(),
  visibility: CommentVisibilitySchema.optional(),
});

export type CommentUpdate = z.infer<typeof CommentUpdateSchema>;
