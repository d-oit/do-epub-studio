import {
  escapeRegex,
  matchAllBounded,
  checkDeadline,
  createDeadline,
} from '@do-epub-studio/shared';
import {
  assessAccessibilityRules,
  type AccessibilityRuleContext,
} from './epub-accessibility-rules';
export * from './epub-accessibility-types';
import type {
  AccessibilityAssessment,
  AccessibilityAssessmentInput,
  AccessibilityAssessmentOptions,
  AccessibilityMetadata,
  AccessibilitySpecProfile,
  AccessibilitySpecRef,
} from './epub-accessibility-types';
/** Registered spec references, keyed by profile selector. */
export const ACCESSIBILITY_SPEC_REFS: Record<AccessibilitySpecProfile, AccessibilitySpecRef> = {
  '1.1': {
    spec: 'EPUB Accessibility',
    specUrl: 'https://www.w3.org/TR/epub-a11y-11/',
    version: '1.1',
    status: 'W3C Recommendation',
    statusDate: '2024-10-17',
  },
  '1.2-draft': {
    spec: 'EPUB Accessibility',
    specUrl: 'https://www.w3.org/TR/epub-a11y-12/',
    version: '1.2',
    status: 'W3C Candidate Recommendation Draft',
    statusDate: '2026-11-11',
  },
};
const OPF_META_MAX_LEN = 1048576;
const ACCESSIBILITY_TIMEOUT_MS = 2_000;

function extractMetaProperty(opfXml: string, property: string): string[] {
  const results: string[] = [];
  const escaped = escapeRegex(property);
  const re = new RegExp(`<meta[^>]*?property\\s*=\\s*"${escaped}"[^>]*?>([^<]*)<\\/meta>`, 'gi');
  for (const m of matchAllBounded(re, opfXml, OPF_META_MAX_LEN)) {
    const value = m[1]?.trim();
    if (value && value.length <= 2048) {
      results.push(value);
    }
  }
  const selfClosingRe = new RegExp(`<meta[^>]*?property\\s*=\\s*"${escaped}"[^>]*?\\/>`, 'gi');
  for (const m of matchAllBounded(selfClosingRe, opfXml, OPF_META_MAX_LEN)) {
    const contentMatch = m[0].match(/content\s*=\s*"([^"]*)"/);
    if (contentMatch) {
      const value = contentMatch[1]?.trim();
      if (value && value.length <= 2048) {
        results.push(value);
      }
    }
  }
  return results;
}

function extractMetaName(opfXml: string, name: string): string[] {
  const results: string[] = [];
  const escaped = escapeRegex(name);
  const re = new RegExp(`<meta[^>]*?name\\s*=\\s*"${escaped}"[^>]*?>([^<]*)<\\/meta>`, 'gi');
  for (const m of matchAllBounded(re, opfXml, OPF_META_MAX_LEN)) {
    const value = m[1]?.trim();
    if (value && value.length <= 2048) {
      results.push(value);
    }
  }
  const selfClosingRe = new RegExp(`<meta[^>]*?name\\s*=\\s*"${escaped}"[^>]*?\\/>`, 'gi');
  for (const m of matchAllBounded(selfClosingRe, opfXml, OPF_META_MAX_LEN)) {
    const contentMatch = m[0].match(/content\s*=\s*"([^"]*)"/);
    if (contentMatch) {
      const value = contentMatch[1]?.trim();
      if (value && value.length <= 2048) {
        results.push(value);
      }
    }
  }
  return results;
}

function extractLinkHrefs(opfXml: string, rel: string): string[] {
  const results: string[] = [];
  const escaped = escapeRegex(rel);
  const re = new RegExp(`<link[^>]*?rel\\s*=\\s*"${escaped}"[^>]*?>`, 'gi');
  for (const m of matchAllBounded(re, opfXml, OPF_META_MAX_LEN)) {
    const hrefMatch = m[0].match(/href\s*=\s*"([^"]*)"/);
    const value = hrefMatch?.[1]?.trim();
    if (value && value.length <= 2048) {
      results.push(value);
    }
  }
  return results;
}

function dedupe(values: string[], maxLen: number): string[] {
  return [...new Set(values)].filter((v) => v.length > 0 && v.length <= maxLen);
}

function optionalValue(values: string[]): string | undefined {
  const first = values[0];
  return first && first.length > 0 ? first : undefined;
}

/** Parse the legacy base metadata surface (used by reader UI and older callers). */
export function parseAccessibilityFromOpf(
  opfXml: string,
  options?: { timeoutMs?: number; traceId?: string },
): AccessibilityMetadata {
  const claims = extractAccessibilityClaims(opfXml, options);
  return {
    summary: claims.summary,
    features: claims.features,
    hazards: claims.hazards,
    controls: claims.controls,
    api: claims.api,
    conformsTo: claims.conformsTo,
    certifiedBy: claims.certifiedBy,
    certifierCredential: claims.certifierCredential,
    certifierReport: claims.certifierReport,
  };
}

/** Extract every accessibility claim the package document declares (profile-neutral). */
export function extractAccessibilityClaims(
  opfXml: string,
  options?: { timeoutMs?: number; traceId?: string },
): AccessibilityMetadata {
  if (!opfXml || opfXml.length > 1048576) {
    return { features: [], hazards: [], controls: [] };
  }

  const timeoutMs = options?.timeoutMs ?? ACCESSIBILITY_TIMEOUT_MS;
  const traceId = options?.traceId;
  const deadline = createDeadline(timeoutMs);

  const summary = optionalValue([
    ...extractMetaProperty(opfXml, 'schema:accessibilitySummary'),
    ...extractMetaName(opfXml, 'schema:accessibilitySummary'),
  ]);
  checkDeadline(deadline, 'accessibility-parse', timeoutMs, traceId);

  const features = dedupe(
    [
      ...extractMetaProperty(opfXml, 'schema:accessibilityFeature'),
      ...extractMetaName(opfXml, 'schema:accessibilityFeature'),
    ],
    256,
  );
  checkDeadline(deadline, 'accessibility-parse', timeoutMs, traceId);

  const hazards = dedupe(
    [
      ...extractMetaProperty(opfXml, 'schema:accessibilityHazard'),
      ...extractMetaName(opfXml, 'schema:accessibilityHazard'),
    ],
    256,
  );
  checkDeadline(deadline, 'accessibility-parse', timeoutMs, traceId);

  const controls = dedupe(
    [
      ...extractMetaProperty(opfXml, 'schema:accessibilityControl'),
      ...extractMetaName(opfXml, 'schema:accessibilityControl'),
    ],
    256,
  );
  checkDeadline(deadline, 'accessibility-parse', timeoutMs, traceId);

  const api = optionalValue([
    ...extractMetaProperty(opfXml, 'schema:accessibilityAPI'),
    ...extractMetaName(opfXml, 'schema:accessibilityAPI'),
  ]);
  checkDeadline(deadline, 'accessibility-parse', timeoutMs, traceId);

  const conformanceClaims = dedupe(
    [
      ...extractMetaProperty(opfXml, 'dcterms:conformsTo'),
      ...extractMetaName(opfXml, 'dcterms:conformsTo'),
    ],
    256,
  );
  checkDeadline(deadline, 'accessibility-parse', timeoutMs, traceId);

  const certifiedBy = optionalValue([
    ...extractMetaProperty(opfXml, 'a11y:certifiedBy'),
    ...extractMetaName(opfXml, 'a11y:certifiedBy'),
  ]);
  checkDeadline(deadline, 'accessibility-parse', timeoutMs, traceId);

  const certifierCredential = optionalValue([
    ...extractMetaProperty(opfXml, 'a11y:certifierCredential'),
    ...extractMetaName(opfXml, 'a11y:certifierCredential'),
  ]);
  checkDeadline(deadline, 'accessibility-parse', timeoutMs, traceId);

  const certifierReport = optionalValue([
    ...extractMetaProperty(opfXml, 'a11y:certifierReport'),
    ...extractMetaName(opfXml, 'a11y:certifierReport'),
  ]);
  checkDeadline(deadline, 'accessibility-parse', timeoutMs, traceId);

  const accessModes = dedupe(
    [
      ...extractMetaProperty(opfXml, 'schema:accessMode'),
      ...extractMetaName(opfXml, 'schema:accessMode'),
    ],
    256,
  );
  checkDeadline(deadline, 'accessibility-parse', timeoutMs, traceId);

  const sufficientAccessModes = dedupe(
    [
      ...extractMetaProperty(opfXml, 'schema:accessModeSufficient'),
      ...extractMetaName(opfXml, 'schema:accessModeSufficient'),
    ],
    256,
  );
  checkDeadline(deadline, 'accessibility-parse', timeoutMs, traceId);

  const contactEmail = optionalValue([
    ...extractMetaProperty(opfXml, 'a11y:contactEmail'),
    ...extractMetaName(opfXml, 'a11y:contactEmail'),
  ]);
  checkDeadline(deadline, 'accessibility-parse', timeoutMs, traceId);

  const evaluationDates = dedupe(
    [...extractMetaProperty(opfXml, 'dcterms:date'), ...extractMetaName(opfXml, 'dcterms:date')],
    256,
  );
  checkDeadline(deadline, 'accessibility-parse', timeoutMs, traceId);

  const certifierReportHrefs = dedupe(extractLinkHrefs(opfXml, 'a11y:certifierReport'), 2048);

  return {
    summary,
    features,
    hazards,
    controls,
    api,
    conformsTo: conformanceClaims[0],
    certifiedBy,
    certifierCredential,
    certifierReport,
    accessModes,
    sufficientAccessModes,
    conformanceClaims,
    contactEmail,
    evaluationDates,
    certifierReportHrefs,
  };
}

/**
 * Assess a package document against one EPUB Accessibility profile.
 *
 * The draft `1.2-draft` profile is experimental: its findings are labeled as
 * such, and it never emits certification claims. Stable `1.1` verdicts are
 * identical regardless of whether draft rules are also run (draft rules are
 * only applied when `specProfile` selects the draft).
 */
export function assessAccessibility(
  input: AccessibilityAssessmentInput,
  options?: AccessibilityAssessmentOptions,
): AccessibilityAssessment {
  const profile = options?.specProfile ?? '1.1';
  const spec = ACCESSIBILITY_SPEC_REFS[profile];
  const timeoutMs = options?.timeoutMs ?? ACCESSIBILITY_TIMEOUT_MS;
  const traceId = options?.traceId;
  const deadline = createDeadline(timeoutMs);

  const metadata = extractAccessibilityClaims(input.opfXml, { timeoutMs, traceId });
  checkDeadline(deadline, 'accessibility-assess', timeoutMs, traceId);

  const context: AccessibilityRuleContext = {
    ...(input.context ?? {}),
    deadline,
    timeoutMs,
    traceId,
  };
  const { findings, evidence } = assessAccessibilityRules(profile, spec, metadata, context);

  const fullClaimPass = evidence.some(
    (record) => record.checkId === 'claim.conformsTo.pattern' && record.result === 'pass',
  );
  const certification: 'declared' | 'not-certified' =
    profile === '1.1' && fullClaimPass && metadata.certifiedBy ? 'declared' : 'not-certified';

  return {
    profile,
    spec,
    metadata,
    findings,
    evidence,
    experimental: profile === '1.2-draft',
    certification,
  };
}
