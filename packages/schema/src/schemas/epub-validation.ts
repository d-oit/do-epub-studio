import { z } from 'zod';

function isSha256(value: string): boolean {
  if (value.length !== 64) return false;
  for (const char of value) {
    if (!'0123456789abcdef'.includes(char)) return false;
  }
  return true;
}

export const EPUBCHECK_VERSION = '5.4.0';

export const EpubFindingSchema = z.object({
  severity: z.enum(['error', 'warning', 'info']),
  code: z.string().max(80),
  location: z.string().max(300).nullable(),
  path: z.string().max(300).nullable(),
  message: z.string().max(500),
});

export const EpubRunnerResultSchema = z.object({
  validatorVersion: z.literal(EPUBCHECK_VERSION),
  sha256: z.string().refine(isSha256),
  epubVersion: z.string().max(10).nullable(),
  findings: z.array(EpubFindingSchema).max(1000),
  accessibility: z.object({
    metadata: z
      .array(
        z.object({
          key: z.string().max(80),
          present: z.literal(true),
          provenance: z.literal('opf'),
        }),
      )
      .max(100),
    advisories: z
      .array(
        z.object({
          category: z.enum([
            'language',
            'headings',
            'navigation-labels',
            'image-alternatives',
            'tables',
            'landmarks',
            'media',
          ]),
          message: z.string().max(300),
          source: z.enum(['machine-metadata', 'machine-advisory', 'manual-review', 'reader-ui']),
        }),
      )
      .max(100),
    manualReviewRequired: z.boolean(),
    certification: z.literal('not-certified'),
  }),
});
export const AccessibilityRemediationSchema = z.object({
  status: z.enum(['not_started', 'in_progress', 'remediated', 'accepted_risk']),
  notes: z.string().max(1000).nullable().optional(),
  checklist: z.record(z.string().max(100), z.boolean()).optional(),
});

export type EpubFinding = z.infer<typeof EpubFindingSchema>;
export type EpubRunnerResult = z.infer<typeof EpubRunnerResultSchema>;
export type AccessibilityRemediation = z.infer<typeof AccessibilityRemediationSchema>;
