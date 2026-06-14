import type { FixedLayoutInfo } from './epub-types';
import { escapeRegex, matchBounded } from '@do-epub-studio/shared';

const OPF_RENDITION_MAX_LEN = 1048576;

function extractRenditionMetaValue(opfXml: string, property: string): string | undefined {
  const escaped = escapeRegex(property);
  const fullProp = `rendition:${escaped}`;
  const re = new RegExp(
    `<meta[^>]*?property\\s*=\\s*"${escapeRegex(fullProp)}"[^>]*?>([^<]*)<\\/meta>`,
    'gi',
  );
  const m = matchBounded(re, opfXml, OPF_RENDITION_MAX_LEN);
  if (m) {
    const val = m[1]?.trim();
    if (val && val.length <= 256) return val;
  }
  const selfClosingRe = new RegExp(
    `<meta[^>]*?property\\s*=\\s*"${escapeRegex(fullProp)}"[^>]*?\\/>`,
    'gi',
  );
  const sm = matchBounded(selfClosingRe, opfXml, OPF_RENDITION_MAX_LEN);
  if (sm) {
    const contentMatch = sm[0].match(/content\s*=\s*"([^"]*)"/);
    if (contentMatch) {
      const val = contentMatch[1]?.trim();
      if (val && val.length <= 256) return val;
    }
  }
  return undefined;
}

const VALID_LAYOUTS = new Set(['reflowable', 'pre-paginated']);
const VALID_ORIENTATIONS = new Set(['auto', 'landscape', 'portrait']);
const VALID_SPREADS = new Set(['none', 'auto', 'both', 'landscape']);

export function parseFixedLayoutFromOpf(opfXml: string): FixedLayoutInfo | undefined {
  if (!opfXml || opfXml.length > 1048576) return undefined;

  const layout = extractRenditionMetaValue(opfXml, 'layout');
  const orientation = extractRenditionMetaValue(opfXml, 'orientation');
  const spread = extractRenditionMetaValue(opfXml, 'spread');
  const viewport = extractRenditionMetaValue(opfXml, 'viewport');

  if (!layout && !orientation && !spread && !viewport) return undefined;

  const result: FixedLayoutInfo = {};
  if (layout && VALID_LAYOUTS.has(layout)) result.layout = layout as FixedLayoutInfo['layout'];
  if (orientation && VALID_ORIENTATIONS.has(orientation)) result.orientation = orientation as FixedLayoutInfo['orientation'];
  if (spread && VALID_SPREADS.has(spread)) result.spread = spread as FixedLayoutInfo['spread'];
  if (viewport) result.viewport = viewport;

  return result;
}

export function isFixedLayout(info?: FixedLayoutInfo): boolean {
  return info?.layout === 'pre-paginated';
}
