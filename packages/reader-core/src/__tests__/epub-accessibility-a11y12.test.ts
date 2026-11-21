import { describe, expect, it } from 'vitest';
import { assessAccessibility, type AccessibilityAssessment } from '../epub-accessibility';
import { METADATA_FIXTURES } from './fixtures/a11y-12.metadata.fixtures';

const EVIDENCE_KEYS = [
  'spec',
  'specUrl',
  'version',
  'status',
  'statusDate',
  'clause',
  'checkId',
  'result',
  'evidence',
  'limitation',
] as const;

function assess(
  fixture: keyof typeof METADATA_FIXTURES,
  profile: '1.1' | '1.2-draft' = '1.2-draft',
): AccessibilityAssessment {
  const { opfXml, context } = METADATA_FIXTURES[fixture];
  return assessAccessibility({ opfXml, context }, { specProfile: profile });
}

function evidenceIds(assessment: AccessibilityAssessment): string[] {
  return assessment.evidence.map((record) => record.checkId);
}

describe('claim discovery', () => {
  it('discovers all 1.2 metadata claims from a positive fixture', () => {
    const assessment = assess('positive');
    expect(assessment.metadata.accessModes).toEqual(['textual', 'visual']);
    expect(assessment.metadata.sufficientAccessModes).toEqual(['textual', 'visual']);
    expect(assessment.metadata.features).toEqual(
      expect.arrayContaining([
        'structuralNavigation',
        'tableOfContents',
        'pageNavigation',
        'alternativeText',
      ]),
    );
    expect(assessment.metadata.hazards).toEqual(['none']);
    expect(assessment.metadata.conformanceClaims).toEqual([
      'EPUB Accessibility 1.2 - WCAG 2.2 Level AA',
    ]);
    expect(assessment.metadata.certifiedBy).toBe('Accessibility Testers Group');
    expect(assessment.metadata.evaluationDates).toEqual(['2026-11-01']);
    expect(assessment.metadata.contactEmail).toBe('a11y@example.com');
    expect(assessment.metadata.certifierReportHrefs).toEqual([
      'https://example.com/reports/9780000000001',
    ]);
  });
});

describe('consistency checks vs actual content', () => {
  it('reports the missing page-list nav when pageNavigation is declared', () => {
    const assessment = assess('contradictory');
    const finding = assessment.findings.find((item) => item.code === 'feature.pageNavigation.nav');
    expect(finding).toBeDefined();
    expect(finding?.severity).toBe('error');
    expect(finding?.path).toBe('OEBPS/nav.xhtml');
    expect(finding?.location).toBe('#page-list');
  });

  it('reports contradictory hazard declarations', () => {
    const assessment = assess('contradictory');
    const finding = assessment.findings.find((item) => item.code === 'hazard.contradiction');
    expect(finding?.severity).toBe('error');
    expect(finding?.message).toContain('none');
    expect(finding?.message).toContain('flashing');
  });

  it('reports sufficient-mode sets that reference no declared mode', () => {
    const assessment = assess('contradictory');
    const finding = assessment.findings.find((item) => item.code === 'modes.sufficient.coverage');
    expect(finding?.severity).toBe('warning');
    expect(finding?.message).toContain('visual');
  });

  it('reports conflicting conformance claims', () => {
    const assessment = assess('contradictory');
    const finding = assessment.findings.find((item) => item.code === 'claim.conformsTo.conflict');
    expect(finding?.severity).toBe('warning');
  });

  it('reports a local evaluator report that does not resolve to a resource', () => {
    const assessment = assess('contradictory');
    const finding = assessment.findings.find((item) => item.code === 'evaluator.report.resource');
    expect(finding?.severity).toBe('warning');
    expect(finding?.path).toBe('reports/missing.xhtml');
  });

  it('does not claim a positive metadata-only feature is verified', () => {
    const assessment = assess('positive');
    const alternativeText = assessment.evidence.find(
      (record) =>
        record.checkId === 'feature.content.unsupported' &&
        record.evidence.includes('alternativeText'),
    );
    expect(alternativeText?.result).toBe('informational');
    expect(alternativeText?.limitation).toMatch(/cannot confirm/i);
  });
});

describe('profile separation', () => {
  it('1.1 verdicts never include draft-only findings or draft spec labels', () => {
    const legacy = assess('negative', '1.1');
    const draft = assess('negative', '1.2-draft');

    expect(
      legacy.findings.some((item) => item.code === 'certification.draft.noCertification'),
    ).toBe(false);
    expect(evidenceIds(legacy)).not.toContain('certification.draft.noCertification');
    for (const record of legacy.evidence) {
      expect(record.status).toBe('W3C Recommendation');
      expect(record.version).toBe('1.1');
    }

    // The 1.2-draft profile flips accessModeSufficient to required and adds
    // experimental labeling; both must be visible in the draft profile only.
    expect(
      draft.findings.some(
        (item) => item.code === 'disc.sufficientAccessModes' && item.severity === 'warning',
      ),
    ).toBe(true);
    expect(draft.experimental).toBe(true);
    expect(legacy.experimental).toBe(false);
  });

  it('draft rules do not alter stable 1.1 verdicts', () => {
    const first = assess('contradictory', '1.1');
    const second = assess('contradictory', '1.1');
    expect(first).toEqual(second);

    const draft = assess('contradictory', '1.2-draft');
    const legacyIds = new Set(evidenceIds(first));
    const draftOnly = evidenceIds(draft).filter((id) => !legacyIds.has(id));
    expect(draftOnly.sort()).toEqual(
      ['certification.draft.noCertification', 'claim.contactEmail.format'].sort(),
    );
  });

  it('never emits certification for the 1.2 draft profile', () => {
    for (const fixture of ['positive', 'negative', 'contradictory'] as const) {
      const assessment = assess(fixture, '1.2-draft');
      expect(assessment.certification).toBe('not-certified');
    }
  });

  it('emits declared certification only for 1.1 with evaluator plus full claim', () => {
    const legacy = assess('positive', '1.1');
    expect(legacy.certification).toBe('declared');

    const missingEvaluator = assess('negative', '1.1');
    expect(missingEvaluator.certification).toBe('not-certified');
  });
});

describe('evidence record shape', () => {
  it('every record carries the full machine-readable evidence fields', () => {
    for (const fixture of ['positive', 'negative', 'contradictory'] as const) {
      const assessment = assess(fixture);
      expect(assessment.evidence.length).toBeGreaterThan(0);
      for (const record of assessment.evidence) {
        for (const key of EVIDENCE_KEYS) {
          expect(typeof record[key]).toBe('string');
          expect(record[key].length).toBeGreaterThan(0);
        }
        expect(['pass', 'fail', 'informational']).toContain(record.result);
      }
    }
  });

  it('still serializes to JSON (report export contract)', () => {
    const assessment = assess('positive');
    const json = JSON.parse(JSON.stringify(assessment));
    expect(json.evidence.length).toBe(assessment.evidence.length);
    expect(json.spec.status).toBe('W3C Candidate Recommendation Draft');
    expect(json.experimental).toBe(true);
  });
});
