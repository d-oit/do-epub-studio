import { z } from 'zod';

export const ANNOTATION_INTERCHANGE_FORMAT =
  'https://do-epub-studio.org/profiles/epub-annotations/1.0-draft' as const;
export const ANNOTATION_INTERCHANGE_VERSION = '1.0-draft' as const;
export const ANNOTATION_INTERCHANGE_MAX_BYTES = 1_000_000;
export const ANNOTATION_INTERCHANGE_MAX_EXTENSION_BYTES = 32_768;

const SafeUriSchema = z
  .string()
  .min(1)
  .max(2048)
  .refine((value) => {
    try {
      const uri = new URL(value);
      return uri.protocol === 'https:' || uri.protocol === 'http:' || uri.protocol === 'urn:';
    } catch {
      return value.startsWith('urn:') && value.length <= 2048;
    }
  }, 'URI must use https, http, or urn');

const JsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string().max(ANNOTATION_INTERCHANGE_MAX_EXTENSION_BYTES),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema).max(128),
    z.record(z.string().max(256), JsonValueSchema),
  ]),
);

export const InterchangeLocatorSchema = z
  .object({
    cfi: z
      .string()
      .min(1)
      .max(2048)
      .regex(/^epubcfi\([^()]{1,1024}\)$/),
    chapterRef: z.string().min(1).max(1024),
    selectedText: z.string().min(1).max(10_000),
    prefix: z.string().max(512).optional(),
    suffix: z.string().max(512).optional(),
    elementIndex: z.number().int().nonnegative().max(1_000_000).optional(),
    charOffset: z.number().int().nonnegative().max(10_000_000).optional(),
  })
  .strict();

export const InterchangeAnnotationSchema = z
  .object({
    id: SafeUriSchema,
    type: z.literal('Annotation'),
    motivation: z.enum(['highlighting', 'bookmarking', 'commenting']),
    created: z.string().datetime().optional(),
    modified: z.string().datetime().optional(),
    target: z
      .object({
        source: SafeUriSchema,
        selector: z
          .object({
            type: z.literal('EPUBFragmentSelector'),
            conformsTo: z.literal('http://www.idpf.org/epub/linking/cfi/epub-cfi.html'),
            value: z
              .string()
              .min(1)
              .max(2048)
              .regex(/^epubcfi\([^()]{1,1024}\)$/),
            locator: InterchangeLocatorSchema,
          })
          .strict(),
      })
      .strict(),
    body: z
      .object({
        type: z.literal('TextualBody'),
        value: z.string().max(10_000),
        purpose: z.enum(['commenting', 'describing']).optional(),
        format: z.literal('text/plain'),
      })
      .strict(),
    extensions: z
      .record(
        z
          .string()
          .url()
          .regex(/^https:\/\//)
          .max(2048)
          .refine((value) => new URL(value).hostname.length > 0),
        JsonValueSchema,
      )
      .optional(),
  })
  .strict();

export const AnnotationInterchangeDocumentSchema = z
  .object({
    format: z.literal(ANNOTATION_INTERCHANGE_FORMAT),
    version: z.literal(ANNOTATION_INTERCHANGE_VERSION),
    type: z.literal('AnnotationCollection'),
    id: SafeUriSchema,
    label: z.string().max(512),
    source: SafeUriSchema,
    items: z.array(InterchangeAnnotationSchema).max(1000),
  })
  .strict();

export type AnnotationInterchangeDocument = z.infer<typeof AnnotationInterchangeDocumentSchema>;
export type InterchangeAnnotation = z.infer<typeof InterchangeAnnotationSchema>;
export type InterchangeLocator = z.infer<typeof InterchangeLocatorSchema>;
