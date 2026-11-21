import { checkDeadline, matchAllBounded, testBounded } from '@do-epub-studio/shared';
import type {
  AccessibilityMetadata,
  AccessibilitySpecRef,
  AccessibilitySpecProfile,
} from './epub-accessibility-types';
import {
  ACCESS_MODE_VALUES,
  checkConformanceClaims,
  checkVocabularyValues,
  discoverCheck,
  EMAIL_RE,
  FEATURE_VALUES,
  HAZARD_VALUES,
  isDeclared,
  ISO8601_DATE_RE,
  makeEvidence,
  makeFinding,
  parseConformanceClaim,
  RELATIVE_HREF_RE,
  type RuleOutput,
} from './epub-accessibility-vocab';

export interface AccessibilityRuleContext {
  navXml?: string;
  navPath?: string;
  resources?: string[];
  spinePaths?: string[];
  contentSample?: Readonly<Record<string, string>>;
  deadline: number;
  timeoutMs: number;
  traceId?: string;
}

const MAX_CONTEXT_LEN = 1048576;

function checkHazardContradiction(
  spec: AccessibilitySpecRef,
  metadata: AccessibilityMetadata,
  output: RuleOutput,
): void {
  const hazards = metadata.hazards;
  if (hazards.includes('none') && hazards.some((hazard) => hazard !== 'none')) {
    const others = hazards.filter((hazard) => hazard !== 'none').join(', ');
    output.findings.push(
      makeFinding(
        'error',
        'hazard.contradiction',
        `Declared accessibilityHazard "none" contradicts the additionally declared hazards (${others}).`,
      ),
    );
    output.evidence.push(
      makeEvidence(
        spec,
        '§2.2',
        'hazard.contradiction',
        'fail',
        `Hazards: ${hazards.join(', ')}.`,
        'A publication cannot be hazard-free and declare hazards at the same time.',
      ),
    );
  }
}

function checkSufficientModes(
  spec: AccessibilitySpecRef,
  metadata: AccessibilityMetadata,
  output: RuleOutput,
): void {
  const modes = metadata.accessModes ?? [];
  const sufficient = metadata.sufficientAccessModes ?? [];
  if (sufficient.length === 0) return;
  if (modes.length === 0) {
    output.findings.push(
      makeFinding(
        'info',
        'modes.sufficient.coverage',
        'accessModeSufficient is declared but no accessMode is declared, so the sufficient sets cannot be cross-checked.',
      ),
    );
    output.evidence.push(
      makeEvidence(
        spec,
        '§2.2',
        'modes.sufficient.coverage',
        'informational',
        'accessModeSufficient present, accessMode absent.',
        'Without accessMode, sufficient-set consistency cannot be verified.',
      ),
    );
    return;
  }
  for (const set of sufficient) {
    const tokens = set
      .split(';')
      .map((token) => token.trim())
      .filter(Boolean);
    if (tokens.length === 0) continue;
    const overlapping = tokens.some((token) => modes.includes(token));
    if (!overlapping) {
      output.findings.push(
        makeFinding(
          'warning',
          'modes.sufficient.coverage',
          `Declared accessModeSufficient set "${set}" does not reference any declared accessMode (${modes.join(', ')}).`,
        ),
      );
      output.evidence.push(
        makeEvidence(
          spec,
          '§2.2',
          'modes.sufficient.coverage',
          'fail',
          `Sufficient set "${set}" vs declared modes ${modes.join(', ')}.`,
          'A sufficient set should be composed of modes the content actually exposes.',
        ),
      );
    }
  }
}

function navHasType(navXml: string, type: string): boolean {
  const re = new RegExp(`<nav\\b[^>]*\\bepub:type\\s*=\\s*"([^"]*)"`, 'gi');
  for (const m of matchAllBounded(re, navXml, MAX_CONTEXT_LEN)) {
    if (!m[1]) continue;
    if (m[1].split(/\s+/).includes(type)) {
      return true;
    }
  }
  return false;
}

function checkFeatureNav(
  spec: AccessibilitySpecRef,
  metadata: AccessibilityMetadata,
  context: AccessibilityRuleContext,
  output: RuleOutput,
): void {
  const navXml = context.navXml;
  const navPath = context.navPath ?? 'nav.xhtml';
  const featureChecks: Array<{
    feature: string;
    type: string;
    clause: string;
    checkId: string;
  }> = [
    {
      feature: 'pageNavigation',
      type: 'page-list',
      clause: '§3.4.1.3.2',
      checkId: 'feature.pageNavigation.nav',
    },
    {
      feature: 'tableOfContents',
      type: 'toc',
      clause: '§3.4.1',
      checkId: 'feature.tableOfContents.nav',
    },
    {
      feature: 'landmarks',
      type: 'landmarks',
      clause: '§3.4.1',
      checkId: 'feature.landmarks.nav',
    },
    {
      feature: 'structuralNavigation',
      type: 'toc',
      clause: '§3.4.1',
      checkId: 'feature.structuralNavigation.nav',
    },
  ];

  for (const check of featureChecks) {
    if (!metadata.features.includes(check.feature)) continue;
    if (!navXml) {
      output.evidence.push(
        makeEvidence(
          spec,
          check.clause,
          check.checkId,
          'informational',
          `Declared feature "${check.feature}" could not be verified: no navigation document was available.`,
          'Navigation-document verification requires the EPUB nav document.',
        ),
      );
      continue;
    }
    const present = navHasType(navXml, check.type);
    if (!present) {
      output.findings.push(
        makeFinding(
          'error',
          check.checkId,
          `Declared feature "${check.feature}" requires a <nav epub:type="${check.type}"> in the navigation document (${check.clause}), but none was found.`,
          `#${check.type}`,
          navPath,
        ),
      );
    }
    output.evidence.push(
      makeEvidence(
        spec,
        check.clause,
        check.checkId,
        present ? 'pass' : 'fail',
        present
          ? `Navigation document declares <nav epub:type="${check.type}">.`
          : `Navigation document has no <nav epub:type="${check.type}">.`,
        'Checks only that the navigation apparatus exists, not its completeness.',
      ),
    );
  }
}

function checkEvaluator(
  profile: AccessibilitySpecProfile,
  spec: AccessibilitySpecRef,
  metadata: AccessibilityMetadata,
  context: AccessibilityRuleContext,
  output: RuleOutput,
): void {
  const hasFullClaim = (metadata.conformanceClaims ?? []).some(
    (claim) => parseConformanceClaim(claim).kind === 'full',
  );

  if (metadata.certifiedBy && !hasFullClaim) {
    output.findings.push(
      makeFinding(
        'warning',
        'evaluator.certifiedBy.target',
        'a11y:certifiedBy is declared without a full §3.5.2 conformance claim to certify.',
      ),
    );
    output.evidence.push(
      makeEvidence(
        spec,
        '§3.5.3.2',
        'evaluator.certifiedBy.target',
        'fail',
        `Evaluator "${metadata.certifiedBy}" declared; no full conformance claim present.`,
        'An evaluator statement should accompany a conformance claim.',
      ),
    );
  }

  const orphanProps: Array<[keyof AccessibilityMetadata, string, string]> = [
    ['certifierCredential', 'a11y:certifierCredential', '§3.5.3.4'],
    ['certifierReport', 'a11y:certifierReport', '§3.5.3.5'],
    ['evaluationDates', 'dcterms:date', '§3.5.3.3'],
  ];
  for (const [prop, label, clause] of orphanProps) {
    if (isDeclared(metadata, prop) && !metadata.certifiedBy) {
      output.findings.push(
        makeFinding(
          'warning',
          'evaluator.orphan',
          `${label} is declared without an a11y:certifiedBy evaluator.`,
        ),
      );
      output.evidence.push(
        makeEvidence(
          spec,
          clause,
          'evaluator.orphan',
          'fail',
          `${label} present without certifiedBy.`,
          'Evaluator-specific properties require an evaluator statement.',
        ),
      );
    }
  }

  for (const date of metadata.evaluationDates ?? []) {
    if (!testBounded(ISO8601_DATE_RE, date, 64)) {
      output.findings.push(
        makeFinding(
          'warning',
          'evaluator.date.format',
          `Evaluation date "${date}" is not an ISO 8601 date (§3.5.3.3).`,
        ),
      );
      output.evidence.push(
        makeEvidence(
          spec,
          '§3.5.3.3',
          'evaluator.date.format',
          'fail',
          `Evaluation date "${date}".`,
          'The spec requires ISO 8601 conformant date strings when a date is present.',
        ),
      );
    }
  }

  const resources = new Set([...(context.resources ?? []), ...(context.spinePaths ?? [])]);
  for (const href of metadata.certifierReportHrefs ?? []) {
    if (testBounded(RELATIVE_HREF_RE, href, 2048)) {
      const normalized = href.split('#')[0]?.replace(/^\/+/, '');
      if (normalized && !resources.has(normalized)) {
        output.findings.push(
          makeFinding(
            'warning',
            'evaluator.report.resource',
            `Evaluator report "${href}" is a local path but does not resolve to a manifest or spine resource.`,
            href,
            normalized,
          ),
        );
        output.evidence.push(
          makeEvidence(
            spec,
            '§3.5.3.5',
            'evaluator.report.resource',
            'fail',
            `Local report href "${href}" not found among ${resources.size} package resources.`,
            'Local report links should resolve to packaged resources.',
          ),
        );
      }
    }
  }

  if (profile === '1.2-draft' && metadata.certifiedBy) {
    output.findings.push(
      makeFinding(
        'info',
        'certification.draft.noCertification',
        'EPUB Accessibility 1.2 is a Candidate Recommendation Draft; evaluator metadata is reported as experimental and carries no certification.',
      ),
    );
    output.evidence.push(
      makeEvidence(
        spec,
        '§3.5.3.2',
        'certification.draft.noCertification',
        'informational',
        'Evaluator metadata present under the 1.2-draft profile.',
        'Draft conformance cannot be certified; certification is only meaningful for stable recommendations.',
      ),
    );
  }

  if (profile === '1.1' && metadata.contactEmail) {
    output.findings.push(
      makeFinding(
        'warning',
        'claim.vocab.12only',
        'a11y:contactEmail is an EPUB Accessibility 1.2 property (issue 2702) and is not part of the 1.1 vocabulary.',
      ),
    );
    output.evidence.push(
      makeEvidence(
        spec,
        '§2.2',
        'claim.vocab.12only',
        'fail',
        'a11y:contactEmail declared under the 1.1 profile.',
        '1.1 does not define contactEmail; treat it as an unknown property.',
      ),
    );
  } else if (metadata.contactEmail && !testBounded(EMAIL_RE, metadata.contactEmail, 256)) {
    output.findings.push(
      makeFinding(
        'warning',
        'claim.contactEmail.format',
        `a11y:contactEmail "${metadata.contactEmail}" does not look like an email address.`,
      ),
    );
    output.evidence.push(
      makeEvidence(
        spec,
        '§B.3.1',
        'claim.contactEmail.format',
        'fail',
        `contactEmail "${metadata.contactEmail}".`,
        'contactEmail should be a valid email address.',
      ),
    );
  }
}

/** Content-based features that cannot be verified from metadata alone. */
const CONTENT_FEATURES: Readonly<Record<string, true>> = {
  alternativeText: true,
  audioDescription: true,
  braille: true,
  captions: true,
  chemML: true,
  describedMath: true,
  displayTransformability: true,
  highContrastDisplay: true,
  index: true,
  largePrint: true,
  latex: true,
  longDescription: true,
  mathML: true,
  printPageNumbers: true,
  rubyAnnotations: true,
  signLanguage: true,
  synchronizedAudioText: true,
  tactileGraphic: true,
  timingControl: true,
  transcript: true,
  ttmlMarkup: true,
  unlocked: true,
};

function checkContentFeatures(
  spec: AccessibilitySpecRef,
  metadata: AccessibilityMetadata,
  output: RuleOutput,
): void {
  for (const feature of metadata.features) {
    if (!(feature in CONTENT_FEATURES)) continue;
    output.evidence.push(
      makeEvidence(
        spec,
        '§2.2',
        'feature.content.unsupported',
        'informational',
        `Declared feature "${feature}" requires content-level verification.`,
        'An automated metadata check cannot confirm this feature is implemented; review the content.',
      ),
    );
  }
}

export function assessAccessibilityRules(
  profile: AccessibilitySpecProfile,
  spec: AccessibilitySpecRef,
  metadata: AccessibilityMetadata,
  context: AccessibilityRuleContext,
): RuleOutput {
  const output: RuleOutput = { findings: [], evidence: [] };

  const discovery: Array<{
    prop: keyof AccessibilityMetadata;
    label: string;
    requirement: 'MUST' | 'SHOULD';
  }> =
    profile === '1.1'
      ? [
          { prop: 'accessModes', label: 'accessMode', requirement: 'MUST' },
          { prop: 'sufficientAccessModes', label: 'accessModeSufficient', requirement: 'SHOULD' },
        ]
      : [
          { prop: 'sufficientAccessModes', label: 'accessModeSufficient', requirement: 'MUST' },
          { prop: 'accessModes', label: 'accessMode', requirement: 'SHOULD' },
        ];
  for (const item of discovery) {
    discoverCheck(spec, metadata, item.prop, item.label, item.requirement, output);
  }
  discoverCheck(spec, metadata, 'features', 'accessibilityFeature', 'MUST', output);
  discoverCheck(spec, metadata, 'hazards', 'accessibilityHazard', 'MUST', output);
  discoverCheck(spec, metadata, 'summary', 'accessibilitySummary', 'SHOULD', output);
  checkDeadline(context.deadline, 'accessibility-rules', context.timeoutMs, context.traceId);

  checkVocabularyValues(
    spec,
    metadata.accessModes ?? [],
    ACCESS_MODE_VALUES,
    'access mode',
    'modes.accessMode',
    '§2.2',
    output,
  );
  checkVocabularyValues(
    spec,
    metadata.hazards,
    HAZARD_VALUES,
    'hazard',
    'hazard.value',
    '§2.2',
    output,
  );
  checkVocabularyValues(
    spec,
    metadata.features,
    FEATURE_VALUES,
    'feature',
    'feature.value',
    '§2.2',
    output,
  );
  checkDeadline(context.deadline, 'accessibility-rules', context.timeoutMs, context.traceId);

  checkHazardContradiction(spec, metadata, output);
  checkSufficientModes(spec, metadata, output);
  checkConformanceClaims(profile, spec, metadata, output);
  checkDeadline(context.deadline, 'accessibility-rules', context.timeoutMs, context.traceId);

  checkFeatureNav(spec, metadata, context, output);
  checkEvaluator(profile, spec, metadata, context, output);
  checkContentFeatures(spec, metadata, output);
  checkDeadline(context.deadline, 'accessibility-rules', context.timeoutMs, context.traceId);

  return output;
}
