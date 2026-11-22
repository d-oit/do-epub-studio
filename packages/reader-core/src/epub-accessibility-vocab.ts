import { matchBounded, testBounded } from '@do-epub-studio/shared';
import type {
  AccessibilityEvidenceRecord,
  AccessibilityFinding,
  AccessibilityMetadata,
  AccessibilitySpecRef,
  AccessibilitySpecProfile,
} from './epub-accessibility-types';

export interface RuleOutput {
  findings: AccessibilityFinding[];
  evidence: AccessibilityEvidenceRecord[];
}

const MAX_CLAIM_LEN = 256;

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
const ISO8601_DATE_RE =
  /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)?$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function makeEvidence(
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

export function makeFinding(
  severity: AccessibilityFinding['severity'],
  code: string,
  message: string,
  location: string | null = null,
  path: string | null = null,
): AccessibilityFinding {
  return { severity, code, location, path, message: message.slice(0, 500) };
}

export function isDeclared(
  metadata: AccessibilityMetadata,
  prop: keyof AccessibilityMetadata,
): boolean {
  const value = metadata[prop];
  return Array.isArray(value) ? value.length > 0 : Boolean(value);
}

export function discoverCheck(
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

export function checkVocabularyValues(
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

export function checkConformanceClaims(
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

export {
  ACCESS_MODE_VALUES,
  HAZARD_VALUES,
  FEATURE_VALUES,
  RELATIVE_HREF_RE,
  ISO8601_DATE_RE,
  EMAIL_RE,
  parseConformanceClaim,
  type ParsedClaim,
};
