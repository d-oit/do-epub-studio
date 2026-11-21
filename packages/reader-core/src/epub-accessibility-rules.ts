import { checkDeadline, matchAllBounded, matchBounded, testBounded } from '@do-epub-studio/shared';
import type {
  AccessibilityEvidenceRecord,
  AccessibilityFinding,
  AccessibilityMetadata,
  AccessibilitySpecRef,
  AccessibilitySpecProfile,
} from './epub-accessibility';

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

interface RuleOutput {
  findings: AccessibilityFinding[];
  evidence: AccessibilityEvidenceRecord[];
}

const MAX_CLAIM_LEN = 256;
const MAX_CONTEXT_LEN = 1048576;

const ACCESS_MODE_VALUES: Readonly<Record<string, true>> = {
  textual: true,
  visual: true,
  auditory: true,
  tactile: true,
};

const HAZARD_VALUES: Readonly<Record<string, true>> = {
  none: true,
  flashing: true,
  sound: true,
  motion: true,
  unknown: true,
};

/** Schema.org accessibilityFeature vocabulary (accessibility properties for discoverability). */
const FEATURE_VALUES: Readonly<Record<string, true>> = {
  alternativeText: true,
  annotations: true,
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
  noMultiPageRead: true,
  printPageNumbers: true,
  readingOrder: true,
  rubyAnnotations: true,
  signLanguage: true,
  structuralNavigation: true,
  synchronizedAudioText: true,
  tableOfContents: true,
  tactileGraphic: true,
  taggedPDF: true,
  timingControl: true,
  transcript: true,
  ttmlMarkup: true,
  unlocked: true,
};

/** §3.5.2 conformance pattern: `EPUB Accessibility <ver> - WCAG <ver> Level <lvl>`. */
const CONFORMANCE_FULL_RE =
  /^EPUB\s+Accessibility\s+(\d+(?:\.\d+)*)\s*-\s*WCAG\s+(\d+\.\d+)\s+Level\s+(A|AA|AAA)$/;

/** Legacy/partial claim form that omits the WCAG portion. */
const CONFORMANCE_BARE_RE = /^EPUB\s+Accessibility\s+(\d+(?:\.\d+)*)$/;

const RELATIVE_HREF_RE = /^(?!https?:|mailto:|tel:|#|\/\/)/i;
const ISO8601_DATE_RE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)?$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function makeEvidence(
  spec: AccessibilitySpecRef,
  clause: string,
  checkId: string,
  result: AccessibilityEvidenceRecord['result'],
  evidence: string,
  limitation: string,
): AccessibilityEvidenceRecord {
  return {
    spec: spec.spec,
    specUrl: spec.specUrl,
    version: spec.version,
    status: spec.status,
    statusDate: spec.statusDate,
    clause,
    checkId,
    result,
    evidence: evidence.slice(0, 500),
    limitation: limitation.slice(0, 300),
  };
}

function makeFinding(
  severity: AccessibilityFinding['severity'],
  code: string,
  message: string,
  location: string | null = null,
  path: string | null = null,
): AccessibilityFinding {
  return { severity, code, location, path, message: message.slice(0, 500) };
}

function isDeclared(metadata: AccessibilityMetadata, prop: keyof AccessibilityMetadata): boolean {
  const value = metadata[prop];
  return Array.isArray(value) ? value.length > 0 : Boolean(value);
}

function discoverCheck(
  spec: AccessibilitySpecRef,
  metadata: AccessibilityMetadata,
  prop: keyof AccessibilityMetadata,
  label: string,
  requirement: 'MUST' | 'SHOULD',
  output: RuleOutput,
): void {
  const present = isDeclared(metadata, prop);
  const severity = requirement === 'MUST' ? 'warning' : 'info';
  if (!present) {
    output.findings.push(
      makeFinding(
        severity,
        `disc.${String(prop)}`,
        `${label} is ${requirement === 'MUST' ? 'required' : 'recommended'} for EPUB Accessibility ${spec.version} (§2.2) but is not declared.`,
      ),
    );
  }
  output.evidence.push(
    makeEvidence(
      spec,
      '§2.2',
      `disc.${String(prop)}`,
      present ? 'pass' : 'fail',
      present ? `${label} declared.` : `${label} not declared.`,
      'Presence check only; semantic correctness of the declared value requires review.',
    ),
  );
}

function checkVocabularyValues(
  spec: AccessibilitySpecRef,
  values: string[],
  vocabulary: Readonly<Record<string, true>>,
  label: string,
  checkId: string,
  clause: string,
  output: RuleOutput,
): void {
  for (const value of values) {
    const normalized = value.trim();
    if (normalized.length === 0 || normalized.length > MAX_CLAIM_LEN) continue;
    const known = normalized in vocabulary;
    if (!known) {
      output.findings.push(
        makeFinding(
          'warning',
          `${checkId}.unknown`,
          `Declared ${label} "${normalized}" is not in the known ${label} vocabulary.`,
        ),
      );
    }
    output.evidence.push(
      makeEvidence(
        spec,
        clause,
        `${checkId}.value`,
        known ? 'pass' : 'fail',
        `${label} "${normalized}".`,
        'Known vocabulary membership only; does not verify the feature is implemented.',
      ),
    );
  }
}

interface ParsedClaim {
  raw: string;
  kind: 'full' | 'bare' | 'invalid';
  version?: string;
  wcagVersion?: string;
  level?: string;
}

function parseConformanceClaim(raw: string): ParsedClaim {
  if (testBounded(CONFORMANCE_FULL_RE, raw, MAX_CLAIM_LEN)) {
    const match = matchBounded(CONFORMANCE_FULL_RE, raw, MAX_CLAIM_LEN);
    return {
      raw,
      kind: 'full',
      version: match?.[1],
      wcagVersion: match?.[2],
      level: match?.[3],
    };
  }
  if (testBounded(CONFORMANCE_BARE_RE, raw, MAX_CLAIM_LEN)) {
    const match = matchBounded(CONFORMANCE_BARE_RE, raw, MAX_CLAIM_LEN);
    return { raw, kind: 'bare', version: match?.[1] };
  }
  return { raw, kind: 'invalid' };
}

function checkConformanceClaims(
  profile: AccessibilitySpecProfile,
  spec: AccessibilitySpecRef,
  metadata: AccessibilityMetadata,
  output: RuleOutput,
): void {
  const claims = metadata.conformanceClaims ?? [];
  if (claims.length === 0) {
    output.evidence.push(
      makeEvidence(
        spec,
        '§3.5.2',
        'claim.conformsTo.pattern',
        'informational',
        'No dcterms:conformsTo conformance claim is declared.',
        'Conformance cannot be assessed without a declared claim.',
      ),
    );
    return;
  }

  const parsed = claims.map(parseConformanceClaim);
  const fullClaims = parsed.filter((claim) => claim.kind === 'full');

  for (const claim of parsed) {
    if (claim.kind === 'invalid') {
      output.findings.push(
        makeFinding(
          'warning',
          'claim.conformsTo.pattern',
          `Conformance claim "${claim.raw}" does not match the required §3.5.2 pattern.`,
        ),
      );
      output.evidence.push(
        makeEvidence(
          spec,
          '§3.5.2',
          'claim.conformsTo.pattern',
          'fail',
          `Claim "${claim.raw}".`,
          'Pattern requires `EPUB Accessibility <ver> - WCAG <ver> Level <lvl>`.',
        ),
      );
      continue;
    }
    if (claim.kind === 'bare') {
      output.findings.push(
        makeFinding(
          'info',
          'claim.conformsTo.pattern',
          `Conformance claim "${claim.raw}" omits the WCAG portion; it is not a full §3.5.2 conformance statement.`,
        ),
      );
      output.evidence.push(
        makeEvidence(
          spec,
          '§3.5.2',
          'claim.conformsTo.pattern',
          'informational',
          `Partial claim "${claim.raw}".`,
          'A full conformance claim must reference the WCAG version and level.',
        ),
      );
      continue;
    }

    const minVersion = profile === '1.1' ? 1.1 : 1.2;
    const versionOk = claim.version !== undefined && Number(claim.version) >= minVersion;
    const wcagOk = claim.wcagVersion !== undefined && Number(claim.wcagVersion) >= 2.0;
    const levelOk = claim.level === 'A' || claim.level === 'AA' || claim.level === 'AAA';

    if (!versionOk) {
      output.findings.push(
        makeFinding(
          'warning',
          'claim.conformsTo.version',
          `Conformance claim "${claim.raw}" references an EPUB Accessibility version unsupported by the ${spec.version} profile.`,
        ),
      );
    }
    if (!wcagOk) {
      output.findings.push(
        makeFinding(
          'warning',
          'claim.conformsTo.version',
          `Conformance claim "${claim.raw}" references WCAG ${claim.wcagVersion}, which is below the required 2.0 (§3.5.2).`,
        ),
      );
    }
    if (!levelOk) {
      output.findings.push(
        makeFinding(
          'warning',
          'claim.conformsTo.version',
          `Conformance claim "${claim.raw}" uses an invalid WCAG conformance level.`,
        ),
      );
    }
    output.evidence.push(
      makeEvidence(
        spec,
        '§3.5.2',
        'claim.conformsTo.pattern',
        versionOk && wcagOk && levelOk ? 'pass' : 'fail',
        `Full conformance claim "${claim.raw}".`,
        'Pattern and version checks only; the underlying WCAG conformance requires review.',
      ),
    );
  }

  if (fullClaims.length > 1) {
    const versions = [...new Set(fullClaims.map((claim) => claim.version).filter(Boolean))];
    if (versions.length > 1) {
      output.findings.push(
        makeFinding(
          'warning',
          'claim.conformsTo.conflict',
          `Multiple conformance claims reference conflicting EPUB Accessibility versions (${versions.join(', ')}).`,
        ),
      );
    }
    output.evidence.push(
      makeEvidence(
        spec,
        '§3.5.2.1',
        'claim.conformsTo.conflict',
        versions.length > 1 ? 'fail' : 'pass',
        `${fullClaims.length} full conformance claims declared.`,
        'The spec allows multiple claims; conflicting targets are reported as contradictions.',
      ),
    );
  }
}

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
    const tokens = set.split(';').map((token) => token.trim()).filter(Boolean);
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

  const discovery: Array<{ prop: keyof AccessibilityMetadata; label: string; requirement: 'MUST' | 'SHOULD' }> =
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
  checkVocabularyValues(spec, metadata.hazards, HAZARD_VALUES, 'hazard', 'hazard.value', '§2.2', output);
  checkVocabularyValues(spec, metadata.features, FEATURE_VALUES, 'feature', 'feature.value', '§2.2', output);
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
