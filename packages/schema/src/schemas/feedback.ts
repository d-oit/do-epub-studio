import { z } from 'zod';

export const FeedbackKindSchema = z.enum(['comment', 'suggestion']);

export const FeedbackCategorySchema = z.enum([
  'general',
  'grammar',
  'spelling',
  'story',
  'logic',
  'style',
]);

export const FeedbackStatusSchema = z.enum([
  'open',
  'accepted',
  'declined',
  'resolved',
  'withdrawn',
]);

export const FeedbackDispositionSchema = z.enum([
  'accepted',
  'declined',
  'resolved',
  'open',
]);

export const FeedbackAnchorSchema = z.object({
  bookFileId: z.string().uuid().optional(),
  chapterRef: z.string().max(255).optional(),
  cfi: z.string().max(2000).optional(),
  selectedText: z.string().min(1).max(5000),
  prefix: z.string().max(1000).optional(),
  suffix: z.string().max(1000).optional(),
});

export type FeedbackAnchor = z.infer<typeof FeedbackAnchorSchema>;

export const FeedbackCreateSchema = z
  .object({
    kind: FeedbackKindSchema,
    category: FeedbackCategorySchema,
    body: z.string().min(1).max(5000),
    proposedText: z.string().max(5000).optional(),
    anchor: FeedbackAnchorSchema,
    mutationId: z.string().uuid(),
  })
  .superRefine((value, context) => {
    if (value.kind === 'suggestion' && !value.proposedText) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'proposedText is required for suggestions',
        path: ['proposedText'],
      });
    }
  });

export type FeedbackCreate = z.infer<typeof FeedbackCreateSchema>;

export const FeedbackReplySchema = z.object({
  body: z.string().min(1).max(5000),
});

export type FeedbackReply = z.infer<typeof FeedbackReplySchema>;

export const FeedbackExportSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
});

export type FeedbackExport = z.infer<typeof FeedbackExportSchema>;

export const CreatorAssignSchema = z.object({
  email: z.string().email().max(255),
});

export type CreatorAssign = z.infer<typeof CreatorAssignSchema>;

// Bounded like the comments list convention (plan 212-P4): no unbounded reads.
export const FeedbackListQuerySchema = z.object({
  status: FeedbackStatusSchema.optional(),
  category: FeedbackCategorySchema.optional(),
  limit: z.coerce.number().int().positive().max(200).default(100),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export type FeedbackListQuery = z.infer<typeof FeedbackListQuerySchema>;
