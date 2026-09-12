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
    // Wave 3: {referenceId: revision} pins captured at compose time, so a
    // later reference edit shows the honest "updated since" drift marker.
    referenceRevisions: z.record(z.string(), z.number().int().positive()).optional(),
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

// ── Wave 3 (COL-03): references & style profile ──────────────────────────

export const ReferenceKindSchema = z.enum([
  'style_excerpt',
  'glossary_term',
  'character_note',
  'fact_note',
  'chronology_note',
  'external_citation',
]);

export const ReferenceOriginSchema = z.enum(['book', 'creator', 'external']);

export const ReferenceCreateSchema = z
  .object({
    kind: ReferenceKindSchema,
    title: z.string().max(255).optional(),
    content: z.string().min(1).max(5000),
    sourceUrl: z.string().url().max(2000).optional(),
    origin: ReferenceOriginSchema,
  })
  .superRefine((value, context) => {
    if (value.origin === 'external' && !value.sourceUrl) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'sourceUrl is required for external references',
        path: ['sourceUrl'],
      });
    }
    if (value.origin !== 'external' && value.sourceUrl) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'sourceUrl is only allowed for external references',
        path: ['sourceUrl'],
      });
    }
  });

export type ReferenceCreate = z.infer<typeof ReferenceCreateSchema>;

export const ReferenceUpdateSchema = z.object({
  title: z.string().max(255).optional(),
  content: z.string().min(1).max(5000).optional(),
  verified: z.boolean().optional(),
});

export type ReferenceUpdate = z.infer<typeof ReferenceUpdateSchema>;

export const ReferenceVerifySchema = z.object({
  verified: z.boolean(),
  evidenceNote: z.string().min(1).max(2000),
});

export type ReferenceVerify = z.infer<typeof ReferenceVerifySchema>;

export const ReferenceListQuerySchema = z.object({
  kind: ReferenceKindSchema.optional(),
  limit: z.coerce.number().int().positive().max(200).default(200),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export type ReferenceListQuery = z.infer<typeof ReferenceListQuerySchema>;

export const StyleProfileSchema = z.object({
  language: z.string().max(50).optional(),
  narrativePerson: z.string().max(100).optional(),
  tense: z.string().max(100).optional(),
  dialogueConventions: z.string().max(2000).optional(),
  dialectNotes: z.string().max(2000).optional(),
  terminology: z.string().max(5000).optional(),
  intentionalExceptions: z.string().max(5000).optional(),
  status: z.enum(['draft', 'approved']),
});

export type StyleProfile = z.infer<typeof StyleProfileSchema>;

export const AnchorStateSchema = z.enum(['unresolved', 'resolved', 'source_changed']);

export type AnchorState = z.infer<typeof AnchorStateSchema>;

// ── Wave 4 (AI-02): cloud assistance consent ─────────────────────────────
//
// Consent-only: recording permission never enables dispatch. Dispatch stays
// refused while no cloud provider is qualified (see the reader-core
// qualification milestones), so this flag models intent, not capability.

export const AssistanceConsentSchema = z.object({
  allowed: z.boolean(),
});

export type AssistanceConsent = z.infer<typeof AssistanceConsentSchema>;
