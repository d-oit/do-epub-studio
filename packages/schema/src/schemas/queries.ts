import { z } from 'zod';
import { EntityTypeSchema } from './common';

export const CspReportSchema = z.object({
  'csp-report': z.object({
    'document-uri': z.string().url(),
    'referrer': z.string().optional(),
    'blocked-uri': z.string().optional(),
    'violated-directive': z.string(),
    'effective-directive': z.string().optional(),
    'original-policy': z.string().optional(),
    'disposition': z.enum(['enforce', 'report']).optional(),
    'status-code': z.number().optional(),
    'script-sample': z.string().optional(),
  }),
});

export type CspReport = z.infer<typeof CspReportSchema>;

export const AuditQuerySchema = z.object({
  entityType: EntityTypeSchema.optional(),
  entityId: z.string().optional(),
  action: z.string().min(1).max(100).optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().nonnegative().max(100_000).default(0),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export type AuditQuery = z.infer<typeof AuditQuerySchema>;

export const CatalogQuerySchema = z.object({
  q: z.string().min(1).max(255).optional(),
  author: z.string().min(1).max(255).optional(),
  language: z.string().min(2).max(16).optional(),
  limit: z.coerce.number().int().positive().max(100).default(24),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export type CatalogQuery = z.infer<typeof CatalogQuerySchema>;

export const LibraryQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export type LibraryQuery = z.infer<typeof LibraryQuerySchema>;

export const SearchQuerySchema = z.object({
  q: z.string().min(1).max(500),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type SearchQuery = z.infer<typeof SearchQuerySchema>;

export const ExportQuerySchema = z.object({
  format: z.enum(['markdown', 'html']).default('markdown'),
});

export type ExportQuery = z.infer<typeof ExportQuerySchema>;

export const NotificationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  unread: z.enum(['true', 'false']).default('false'),
});

export type NotificationsQuery = z.infer<typeof NotificationsQuerySchema>;

export const ValidateQuerySchema = z.object({
  bookId: z.string().min(1).max(255),
});

export const SignedUrlSchema = z.object({
  expires: z.string().min(1).max(64),
  signature: z.string().min(1).max(255),
});

export const UploadCompleteSchema = z.object({
  storageKey: z.string().min(1).max(1024),
  originalFilename: z.string().min(1).max(500),
  mimeType: z.string().max(200).optional(),
  fileSizeBytes: z.number().int().nonnegative().optional(),
  sha256: z.string().max(64).optional(),
  epubVersion: z.string().max(10).optional(),
  validationResults: z
    .object({
      isValid: z.boolean(),
      errors: z.array(z.string().max(1000)),
      warnings: z.array(z.string().max(1000)),
      epubVersion: z.string().max(10).optional(),
    })
    .optional(),
});
