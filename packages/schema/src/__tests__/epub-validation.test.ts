import { describe, it, expect } from 'vitest';
import {
  EPUBCHECK_VERSION,
  EpubFindingSchema,
  EpubRunnerResultSchema,
  AccessibilityRemediationSchema,
} from '../schemas';

describe('epub-validation schemas', () => {
  it('validates EPUB findings', () => {
    const finding = {
      severity: 'error' as const,
      code: 'RSC-005',
      location: 'OEBPS/ch1.xhtml:10',
      path: 'OEBPS/ch1.xhtml',
      message: 'Error message',
    };
    expect(EpubFindingSchema.parse(finding)).toEqual(finding);

    expect(() =>
      EpubFindingSchema.parse({
        ...finding,
        severity: 'fatal',
      }),
    ).toThrow();
  });

  it('validates EpubRunnerResult with valid sha256', () => {
    const valid = {
      validatorVersion: EPUBCHECK_VERSION,
      sha256: 'a'.repeat(64),
      epubVersion: '3.0',
      findings: [
        {
          severity: 'warning' as const,
          code: 'ACC-001',
          location: null,
          path: null,
          message: 'Warning',
        },
      ],
      accessibility: {
        metadata: [{ key: 'dc:language', present: true as const, provenance: 'opf' as const }],
        advisories: [
          {
            category: 'language' as const,
            message: 'Check language',
            source: 'manual-review' as const,
          },
        ],
        manualReviewRequired: true,
        certification: 'not-certified' as const,
      },
    };
    expect(EpubRunnerResultSchema.parse(valid)).toEqual(valid);

    // sha256 wrong length
    expect(() =>
      EpubRunnerResultSchema.parse({
        ...valid,
        sha256: 'a'.repeat(63),
      }),
    ).toThrow();

    // sha256 invalid characters
    expect(() =>
      EpubRunnerResultSchema.parse({
        ...valid,
        sha256: 'g'.repeat(64),
      }),
    ).toThrow();
  });

  it('validates AccessibilityRemediationSchema', () => {
    const state = {
      status: 'in_progress' as const,
      notes: 'Work underway',
      checklist: { 'headings-checked': true, 'contrast-checked': false },
    };
    expect(AccessibilityRemediationSchema.parse(state)).toEqual(state);

    expect(() =>
      AccessibilityRemediationSchema.parse({
        status: 'invalid_status',
      }),
    ).toThrow();
  });
});
