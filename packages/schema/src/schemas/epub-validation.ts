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

export const EpubAccessibilityMetadataItemSchema = z.object({
  key: z.string().max(80),
  value: z.string().max(500),
  present: z.boolean().optional(),
  provenance: z.literal('opf'),
});
export const EpubAccessibilitySpecRefSchema = z.object({
  spec: z.string().max(80),
  specUrl: z.string().max(300),
  version: z.string().max(20),
  status: z.string().max(80),
  statusDate: z.string().max(20),
});

export const EpubAccessibilityEvidenceRecordSchema = z.object({
  spec: z.string().max(80),
  specUrl: z.string().max(300),
  version: z.string().max(20),
  status: z.string().max(80),
  statusDate: z.string().max(20),
  clause: z.string().max(60),
  checkId: z.string().max(80),
  result: z.enum(['pass', 'fail', 'informational']),
  evidence: z.string().max(500),
  limitation: z.string().max(300),
});

export const EpubAccessibilityProfileSchema = z.object({
  spec: EpubAccessibilitySpecRefSchema.nullable(),
  experimental: z.boolean(),
  certification: z.enum(['declared', 'not-certified']),
  findings: z.array(EpubFindingSchema).max(200),
  evidence: z.array(EpubAccessibilityEvidenceRecordSchema).max(300),
});

export const EpubRunnerResultSchema = z.object({
  validatorVersion: z.literal(EPUBCHECK_VERSION),
  sha256: z.string().refine(isSha256),
  epubVersion: z.string().max(10).nullable(),
  findings: z.array(EpubFindingSchema).max(1000),
  accessibility: z.object({
    metadata: z.array(EpubAccessibilityMetadataItemSchema).max(100),
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
            'reader-ui',
          ]),
          message: z.string().max(300),
          source: z.enum(['machine-metadata', 'machine-advisory', 'manual-review', 'reader-ui']),
        }),
      )
      .max(100),
    manualReviewRequired: z.boolean(),
    certification: z.enum(['declared', 'not-certified']),
    profiles: z.object({
      '1.1': EpubAccessibilityProfileSchema,
      '1.2-draft': EpubAccessibilityProfileSchema,
    }),
  }),
});
export const AccessibilityRemediationSchema = z.object({
  status: z.enum(['not_started', 'in_progress', 'remediated', 'accepted_risk']),
  notes: z.string().max(1000).nullable().optional(),
  checklist: z.record(z.string().max(100), z.boolean()).optional(),
});

export type EpubAccessibilitySpecRef = z.infer<typeof EpubAccessibilitySpecRefSchema>;
export type EpubAccessibilityEvidenceRecord = z.infer<typeof EpubAccessibilityEvidenceRecordSchema>;
export type EpubAccessibilityProfile = z.infer<typeof EpubAccessibilityProfileSchema>;

export type EpubFinding = z.infer<typeof EpubFindingSchema>;
export type EpubAccessibilityMetadataItem = z.infer<typeof EpubAccessibilityMetadataItemSchema>;
export type EpubRunnerResult = z.infer<typeof EpubRunnerResultSchema>;
export type AccessibilityRemediation = z.infer<typeof AccessibilityRemediationSchema>;
