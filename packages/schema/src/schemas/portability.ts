import { z } from 'zod';
import { AnnotationInterchangeDocumentSchema } from './annotation-interchange';
import { ProgressLocatorSchema } from './annotation';

/**
 * Data portability envelope (v1).
 *
 * A versioned container for a user's library and reading state — annotations
 * (highlights, bookmarks, comments) mapped to the W3C Web Annotation Data
 * Model / EPUB Annotations profile, per-book reading progress, and reader
 * preferences. See docs/portability.md for the full specification.
 *
 * The envelope is a documented interchange format, not an internal table
 * dump: every value mirrors a public API DTO or the W3C annotation model,
 * and internal bookkeeping is carried losslessly as namespaced JSON
 * extensions on annotation items.
 */

export const PORTABILITY_FORMAT = 'do-epub-studio.portability' as const;
export const PORTABILITY_VERSION = 1 as const;
export const PORTABILITY_PROFILE =
  'https://do-epub-studio.org/profiles/portability/v1' as const;

/** Hard cap on envelope items (a library with more needs multiple archives). */
export const PORTABILITY_MAX_ITEMS = 10_000;
/** Hard cap on serialized envelope payload (JSON body before ZIP bundling). */
export const PORTABILITY_MAX_PAYLOAD_BYTES = 50 * 1024 * 1024;
/** Maximum serialized size of a single publication item, annotations included. */
export const PORTABILITY_MAX_ITEM_BYTES = 5 * 1024 * 1024;

export const PortabilityScopeSchema = z.enum(['book', 'account']);

/** Reader preferences exported as user metadata (subset of the preferences store). */
export const PortabilityPreferencesSchema = z
  .object({
    theme: z.enum(['light', 'dark', 'sepia', 'system']),
    fontFamily: z.enum(['serif', 'sans-serif', 'monospace']),
    lineHeight: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    fontSize: z.enum(['small', 'medium', 'large', 'xlarge']),
    pageWidth: z.enum(['narrow', 'normal', 'wide', 'full']),
    direction: z.enum(['default', 'ltr', 'rtl']),
    writingMode: z.enum(['horizontal-tb', 'vertical-rl', 'vertical-lr']),
    aiEnabled: z.boolean(),
  })
  .strict();

/**
 * Reading progress for a book. Mirrors the worker's progress DTO (locator in
 * `ProgressLocatorSchema` shape), never the raw `reading_progress` row.
 */
export const PortabilityProgressSchema = z
  .object({
    locator: ProgressLocatorSchema.nullable(),
    progressPercent: z.number().min(0).max(100),
    updatedAt: z.string().datetime().nullable(),
  })
  .strict();

/**
 * Book file reference included on explicit opt-in. The bytes travel in a ZIP
 * archive next to the envelope JSON (`archive.filename` names the ZIP entry);
 * this field proves inclusion rather than hiding a table shape.
 */
export const PortabilityArchiveRefSchema = z
  .object({
    included: z.literal(true),
    filename: z.string().min(1).max(255),
    sizeBytes: z.number().int().nonnegative().max(1_000_000_000),
  })
  .strict();

/**
 * Entities that lack a usable locator (no CFI, chapter, or quoted text)
 * cannot be represented in the W3C EPUB Annotations model. They travel
 * losslessly here and are reported as unanchored on import.
 */
export const PortabilityOrphanEntitiesSchema = z
  .object({
    highlights: z
      .array(
        z
          .object({
            id: z.string().min(1).max(255),
            note: z.string().max(5000).nullable(),
            color: z.string().max(32),
            createdAt: z.string().datetime(),
            updatedAt: z.string().datetime(),
          })
          .strict(),
      )
      .max(5000),
    comments: z
      .array(
        z
          .object({
            id: z.string().min(1).max(255),
            body: z.string().min(1).max(10000),
            status: z.string().max(32),
            visibility: z.string().max(32),
            parentCommentId: z.string().max(255).nullable(),
            createdAt: z.string().datetime(),
            updatedAt: z.string().datetime(),
            resolvedAt: z.string().datetime().nullable(),
          })
          .strict(),
      )
      .max(5000),
    bookmarks: z
      .array(
        z
          .object({
            id: z.string().min(1).max(255),
            label: z.string().max(255).nullable(),
            createdAt: z.string().datetime(),
          })
          .strict(),
      )
      .max(5000),
  })
  .strict();
/**
 * Per-book portability item. `annotations` is a full W3C EPUB Annotations
 * document; internal fields are preserved as namespaced extensions on each
 * annotation (see docs/portability.md §Extensions).
 */
export const PortabilityPublicationItemSchema = z
  .object({
    type: z.literal('publication'),
    id: z.string().uuid(),
    bookId: z.string().min(1).max(200),
    slug: z.string().min(1).max(255).optional(),
    title: z.string().min(1).max(500),
    annotations: AnnotationInterchangeDocumentSchema,
    orphans: PortabilityOrphanEntitiesSchema.optional(),
    progress: PortabilityProgressSchema.nullable(),
  })
  .strict();

/** Account-level item: reader preferences (user metadata). */
export const PortabilityPreferencesItemSchema = z
  .object({
    type: z.literal('preferences'),
    id: z.string().uuid(),
    preferences: PortabilityPreferencesSchema,
  })
  .strict();

export const PortabilityItemSchema = z.discriminatedUnion('type', [
  PortabilityPublicationItemSchema,
  PortabilityPreferencesItemSchema,
]);

export const PortabilityEnvelopeSchema = z
  .object({
    format: z.literal(PORTABILITY_FORMAT),
    version: z.literal(PORTABILITY_VERSION),
    profile: z.literal(PORTABILITY_PROFILE),
    id: z.string().uuid(),
    /** Idempotency key for the whole archive; regenerate per export. */
    idempotencyKey: z.string().uuid().optional(),
    exportedAt: z.string().datetime(),
    scope: PortabilityScopeSchema,
    app: z
      .object({
        name: z.literal('do-epub-studio'),
        version: z.string().min(1).max(64),
      })
      .strict()
      .optional(),
    items: z.array(PortabilityItemSchema).max(PORTABILITY_MAX_ITEMS),
  })
  .strict()
  .refine((envelope) => {
    const ids = envelope.items.map((item) => item.id);
    return new Set(ids).size === ids.length;
  }, 'Item ids must be unique within an envelope');

export type PortabilityEnvelope = z.infer<typeof PortabilityEnvelopeSchema>;
export type PortabilityItem = z.infer<typeof PortabilityItemSchema>;
export type PortabilityPublicationItem = z.infer<typeof PortabilityPublicationItemSchema>;
export type PortabilityPreferencesItem = z.infer<typeof PortabilityPreferencesItemSchema>;
export type PortabilityPreferences = z.infer<typeof PortabilityPreferencesSchema>;
export type PortabilityProgress = z.infer<typeof PortabilityProgressSchema>;
export type PortabilityScope = z.infer<typeof PortabilityScopeSchema>;

/**
 * Deterministic serialization for export: the object literal key order above
 * is fixed, and `JSON.stringify` preserves it. Keep this as the single way an
 * envelope is turned into bytes so archives are reproducible for identical
 * inputs.
 */
export function serializePortabilityEnvelope(envelope: PortabilityEnvelope): string {
  const envelope2 = PortabilityEnvelopeSchema.parse(envelope);
  const serialized = JSON.stringify(envelope2);
  if (serialized.length > PORTABILITY_MAX_PAYLOAD_BYTES) {
    throw new Error('Portability envelope exceeds the 50 MB payload limit');
  }
  return serialized;
}
