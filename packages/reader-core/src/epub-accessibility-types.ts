/** Shared types for EPUB Accessibility assessment (issue #1487). */

export type AccessibilitySpecProfile = '1.1' | '1.2-draft';

/** Machine-readable reference to the target EPUB Accessibility specification. */
export interface AccessibilitySpecRef {
  spec: string;
  specUrl: string;
  version: string;
  status: string;
  statusDate: string;
}

export interface AccessibilityMetadata {
  summary?: string;
  features: string[];
  hazards: string[];
  controls: string[];
  api?: string;
  conformsTo?: string;
  certifiedBy?: string;
  certifierCredential?: string;
  certifierReport?: string;
  /** `schema:accessMode` values (human perceptual systems needed to process content). */
  accessModes?: string[];
  /** `schema:accessModeSufficient` sets (each value may list modes separated by `;`). */
  sufficientAccessModes?: string[];
  /** Every `dcterms:conformsTo` value, for multi-claim analysis. */
  conformanceClaims?: string[];
  /** `a11y:contactEmail` — added in EPUB Accessibility 1.2 (issue 2702). */
  contactEmail?: string;
  /** `dcterms:date` evaluation dates (EPUB 3 meta form). */
  evaluationDates?: string[];
  /** `a11y:certifierReport` link hrefs (`<link rel="a11y:certifierReport" href="..."/>`). */
  certifierReportHrefs?: string[];
}

export interface AccessibilityFinding {
  severity: 'error' | 'warning' | 'info';
  code: string;
  location: string | null;
  path: string | null;
  message: string;
}

/** Machine-readable evidence record per requirement check (see issue #1487). */
export interface AccessibilityEvidenceRecord {
  spec: string;
  specUrl: string;
  version: string;
  status: string;
  statusDate: string;
  clause: string;
  checkId: string;
  result: 'pass' | 'fail' | 'informational';
  evidence: string;
  limitation: string;
}

/** Content-side context used to verify declared claims against actual content. */
export interface AccessibilityContentContext {
  /** Navigation document XML (EPUB 3 nav), when extractable. */
  navXml?: string;
  /** Navigation document path inside the container, for finding locations. */
  navPath?: string;
  /** Manifest item paths (normalized, without leading `/`). */
  resources?: string[];
  /** Spine item paths (normalized, without leading `/`). */
  spinePaths?: string[];
  /** Sampled content by path (bounded by the caller) for cheap content checks. */
  contentSample?: Readonly<Record<string, string>>;
}

export interface AccessibilityAssessmentInput {
  opfXml: string;
  context?: AccessibilityContentContext;
}

export interface AccessibilityAssessmentOptions {
  specProfile?: AccessibilitySpecProfile;
  timeoutMs?: number;
  traceId?: string;
}

export interface AccessibilityAssessment {
  profile: AccessibilitySpecProfile;
  spec: AccessibilitySpecRef;
  metadata: AccessibilityMetadata;
  findings: AccessibilityFinding[];
  evidence: AccessibilityEvidenceRecord[];
  /** Draft profiles are experimental and never certification. */
  experimental: boolean;
  certification: 'declared' | 'not-certified';
}
