import { z } from 'zod';
import { BookVisibilitySchema } from './common';

export const CreateBookSchema = z.object({
  title: z.string().min(1).max(500),
  slug: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[a-z0-9_-]+$/),
  authorName: z.string().max(255).optional(),
  description: z.string().max(5000).optional(),
  language: z.string().length(2).default('en'),
  visibility: BookVisibilitySchema.default('private'),
});

export type CreateBook = z.infer<typeof CreateBookSchema>;

export const UpdateBookSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  authorName: z.string().max(255).optional(),
  description: z.string().max(5000).optional(),
  language: z.string().length(2).optional(),
  visibility: BookVisibilitySchema.optional(),
});

export type UpdateBook = z.infer<typeof UpdateBookSchema>;
