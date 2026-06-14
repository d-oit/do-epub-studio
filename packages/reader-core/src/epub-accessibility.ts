import { escapeRegex, matchAllBounded } from '@do-epub-studio/shared';

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
}

const OPF_META_MAX_LEN = 1048576;

function extractMetaProperty(opfXml: string, property: string): string[] {
  const results: string[] = [];
  const escaped = escapeRegex(property);
  const re = new RegExp(
    `<meta[^>]*?property\\s*=\\s*"${escaped}"[^>]*?>([^<]*)<\\/meta>`,
    'gi',
  );
  for (const m of matchAllBounded(re, opfXml, OPF_META_MAX_LEN)) {
    const value = m[1]?.trim();
    if (value && value.length <= 2048) {
      results.push(value);
    }
  }
  const selfClosingRe = new RegExp(
    `<meta[^>]*?property\\s*=\\s*"${escaped}"[^>]*?\\/>`,
    'gi',
  );
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
  const re = new RegExp(
    `<meta[^>]*?name\\s*=\\s*"${escaped}"[^>]*?>([^<]*)<\\/meta>`,
    'gi',
  );
  for (const m of matchAllBounded(re, opfXml, OPF_META_MAX_LEN)) {
    const value = m[1]?.trim();
    if (value && value.length <= 2048) {
      results.push(value);
    }
  }
  const selfClosingRe = new RegExp(
    `<meta[^>]*?name\\s*=\\s*"${escaped}"[^>]*?\\/>`,
    'gi',
  );
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

export function parseAccessibilityFromOpf(opfXml: string): AccessibilityMetadata {
  if (!opfXml || opfXml.length > 1048576) {
    return { features: [], hazards: [], controls: [] };
  }

  const summary = extractMetaProperty(opfXml, 'schema:accessibilitySummary')[0]
    ?? extractMetaName(opfXml, 'schema:accessibilitySummary')[0]
    ?? undefined;

  const features = [
    ...new Set([
      ...extractMetaProperty(opfXml, 'schema:accessibilityFeature'),
      ...extractMetaName(opfXml, 'schema:accessibilityFeature'),
    ]),
  ].filter((f) => f.length > 0 && f.length <= 256);

  const hazards = [
    ...new Set([
      ...extractMetaProperty(opfXml, 'schema:accessibilityHazard'),
      ...extractMetaName(opfXml, 'schema:accessibilityHazard'),
    ]),
  ].filter((h) => h.length > 0 && h.length <= 256);

  const controls = [
    ...new Set([
      ...extractMetaProperty(opfXml, 'schema:accessibilityControl'),
      ...extractMetaName(opfXml, 'schema:accessibilityControl'),
    ]),
  ].filter((c) => c.length > 0 && c.length <= 256);

  const api =
    extractMetaProperty(opfXml, 'schema:accessibilityAPI')[0]
    ?? extractMetaName(opfXml, 'schema:accessibilityAPI')[0]
    ?? undefined;

  const conformsTo =
    extractMetaProperty(opfXml, 'dcterms:conformsTo')[0]
    ?? extractMetaName(opfXml, 'dcterms:conformsTo')[0]
    ?? undefined;

  const certifiedBy =
    extractMetaProperty(opfXml, 'a11y:certifiedBy')[0]
    ?? extractMetaName(opfXml, 'a11y:certifiedBy')[0]
    ?? undefined;

  const certifierCredential =
    extractMetaProperty(opfXml, 'a11y:certifierCredential')[0]
    ?? extractMetaName(opfXml, 'a11y:certifierCredential')[0]
    ?? undefined;

  const certifierReport =
    extractMetaProperty(opfXml, 'a11y:certifierReport')[0]
    ?? extractMetaName(opfXml, 'a11y:certifierReport')[0]
    ?? undefined;

  return {
    summary: summary && summary.length > 0 ? summary : undefined,
    features,
    hazards,
    controls,
    api: api && api.length > 0 ? api : undefined,
    conformsTo: conformsTo && conformsTo.length > 0 ? conformsTo : undefined,
    certifiedBy: certifiedBy && certifiedBy.length > 0 ? certifiedBy : undefined,
    certifierCredential: certifierCredential && certifierCredential.length > 0 ? certifierCredential : undefined,
    certifierReport: certifierReport && certifierReport.length > 0 ? certifierReport : undefined,
  };
}
