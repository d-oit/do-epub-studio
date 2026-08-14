import { z } from 'zod';

export const BookVisibilitySchema = z.enum([
  'private',
  'password_protected',
  'reader_only',
  'editorial_review',
  'public',
]);

export const GrantModeSchema = z.enum([
  'private',
  'password_protected',
  'reader_only',
  'editorial_review',
  'public',
]);

export const CommentStatusSchema = z.enum(['open', 'resolved', 'deleted']);

export const CommentVisibilitySchema = z.enum(['shared', 'internal', 'resolved']);

export const EntityTypeSchema = z.enum([
  'book',
  'grant',
  'session',
  'comment',
  'user',
  'bookmark',
  'highlight',
]);

/** Flexible locator type for export/import (no Zod validation — use MultiSignalLocatorSchema for API boundaries) */
export interface AnnotationLocator {
  cfi?: string;
  selectedText?: string;
  chapterRef?: string;
  elementIndex?: number;
  charOffset?: number;
}

// Multi-signal locator requiring CFI + text + chapter per ADR-006
export const MultiSignalLocatorSchema = z
  .object({
    cfi: z.string().min(1, 'CFI is required for multi-signal locator').max(2048),
    selectedText: z
      .string()
      .min(1, 'Selected text is required for multi-signal locator')
      .max(10000),
    chapterRef: z
      .string()
      .min(1, 'Chapter reference is required for multi-signal locator')
      .max(1024),
  })
  .strict();

export function formatZodError(error: {
  issues: Array<{ path: (string | number)[]; message: string }>;
}): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') + ': ' : '';
      return path + issue.message;
    })
    .join('; ');
}
