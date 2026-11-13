import type { RenditionItem } from './epub-types';

export const MAX_CONTAINER_BYTES = 64 * 1024;
export const MAX_ROOTFILES_COUNT = 10;
export const OPF_MEDIA_TYPE = 'application/oebps-package+xml';

export class ContainerParsingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContainerParsingError';
  }
}

/**
 * Normalizes rootfile path inside the publication archive.
 * Rejects remote schemes, windows drive letters, and directory traversal above root.
 */
export function normalizeRootfilePath(rawPath: string): string {
  const trimmed = rawPath.trim();
  if (!trimmed) {
    throw new ContainerParsingError('Empty rootfile path');
  }

  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed) || trimmed.startsWith('//')) {
    throw new ContainerParsingError(`Remote rootfile path forbidden: ${trimmed}`);
  }

  if (/^[a-zA-Z]:/.test(trimmed)) {
    throw new ContainerParsingError(`Absolute drive rootfile path forbidden: ${trimmed}`);
  }

  const parts = trimmed.replace(/^\//, '').split('/');
  const stack: string[] = [];
  for (const part of parts) {
    if (part === '.' || !part) continue;
    if (part === '..') {
      if (stack.length === 0) {
        throw new ContainerParsingError(`Rootfile path escapes archive root: ${rawPath}`);
      }
      stack.pop();
    } else {
      stack.push(part);
    }
  }

  return stack.join('/');
}

export interface RawRootfileEntry {
  fullPath: string;
  mediaType: string;
}

/**
 * Parses all `<rootfile>` elements from `META-INF/container.xml`.
 */
export function parseContainerXml(containerXml: string): RawRootfileEntry[] {
  if (!containerXml || typeof containerXml !== 'string') {
    throw new ContainerParsingError('Empty or invalid container.xml');
  }

  if (containerXml.length > MAX_CONTAINER_BYTES) {
    throw new ContainerParsingError(
      `container.xml exceeds maximum allowed size of ${MAX_CONTAINER_BYTES} bytes`,
    );
  }

  const entries: RawRootfileEntry[] = [];

  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser();
    const doc = parser.parseFromString(containerXml, 'application/xml');
    const parserError = doc.querySelector('parsererror');
    if (parserError) {
      throw new ContainerParsingError(
        `Failed to parse container.xml: ${parserError.textContent?.slice(0, 100)}`,
      );
    }

    const rootfileNodes = doc.querySelectorAll('rootfile');
    for (const rf of Array.from(rootfileNodes)) {
      if (entries.length >= MAX_ROOTFILES_COUNT) break;

      const rawFullPath = rf.getAttribute('full-path');
      const mediaType = rf.getAttribute('media-type') ?? OPF_MEDIA_TYPE;

      if (!rawFullPath) continue;

      try {
        const fullPath = normalizeRootfilePath(rawFullPath);
        entries.push({ fullPath, mediaType });
      } catch {
        // Skip malformed rootfile paths without breaking the whole container
      }
    }
  } else {
    // Regex-based parsing fallback for minimal headless environments
    const rootfileRegex = /<rootfile\b([^>]*)\/?>/gi;
    let match: RegExpExecArray | null;
    while ((match = rootfileRegex.exec(containerXml)) !== null) {
      if (entries.length >= MAX_ROOTFILES_COUNT) break;

      const attrs = match[1];
      if (!attrs) continue;

      const fullPathMatch = /\bfull-path=["']([^"']+)["']/i.exec(attrs);
      const mediaTypeMatch = /\bmedia-type=["']([^"']+)["']/i.exec(attrs);

      if (!fullPathMatch?.[1]) continue;

      try {
        const fullPath = normalizeRootfilePath(fullPathMatch[1]);
        const mediaType = mediaTypeMatch?.[1] ?? OPF_MEDIA_TYPE;
        entries.push({ fullPath, mediaType });
      } catch {
        // Skip malformed rootfile
      }
    }
  }

  if (entries.length === 0) {
    throw new ContainerParsingError('No valid rootfile found in container.xml');
  }

  return entries;
}

export interface PackageMetadataSummary {
  title?: string;
  language?: string;
  layout?: 'reflowable' | 'pre-paginated';
}

/**
 * Extracts basic metadata (title, language, rendition layout) from an OPF package XML string.
 */
function extractElementTextLinear(xml: string, tagName: string): string | undefined {
  const openPrefix = `<${tagName}`;
  const closeTag = `</${tagName}>`;
  const lower = xml.toLowerCase();
  const startIdx = lower.indexOf(openPrefix.toLowerCase());
  if (startIdx < 0) return undefined;
  const afterOpen = lower.indexOf('>', startIdx + openPrefix.length);
  if (afterOpen < 0) return undefined;
  const closeIdx = lower.indexOf(closeTag.toLowerCase(), afterOpen + 1);
  if (closeIdx < 0) return undefined;
  const text = xml.slice(afterOpen + 1, closeIdx).trim();
  return text || undefined;
}

function extractRenditionLayoutLinear(xml: string): 'reflowable' | 'pre-paginated' | undefined {
  const lower = xml.toLowerCase();
  let pos = 0;
  while (pos < lower.length) {
    const startIdx = lower.indexOf('<meta', pos);
    if (startIdx < 0) break;
    const gtIdx = lower.indexOf('>', startIdx + 5);
    if (gtIdx < 0) break;
    const attrs = lower.slice(startIdx + 5, gtIdx);
    if (attrs.includes('rendition:layout')) {
      const closeIdx = lower.indexOf('</meta>', gtIdx + 1);
      if (closeIdx >= 0) {
        const val = xml
          .slice(gtIdx + 1, closeIdx)
          .trim()
          .toLowerCase();
        if (val === 'pre-paginated') return 'pre-paginated';
        if (val === 'reflowable') return 'reflowable';
      }
    }
    pos = gtIdx + 1;
  }
  return undefined;
}

export function extractOpfMetadataSummary(opfXml: string): PackageMetadataSummary {
  if (!opfXml || typeof opfXml !== 'string') return {};
  const bounded = opfXml.slice(0, 1024 * 1024);

  return {
    title: extractElementTextLinear(bounded, 'dc:title'),
    language: extractElementTextLinear(bounded, 'dc:language'),
    layout: extractRenditionLayoutLinear(bounded),
  };
}

/**
 * Derives a user-friendly rendition label without exposing raw internal filesystem paths.
 */
export function deriveRenditionLabel(
  summary: PackageMetadataSummary,
  index: number,
  isDefault: boolean,
): string {
  if (summary.layout === 'pre-paginated') {
    return isDefault ? 'Fixed Layout (Default)' : 'Fixed Layout';
  }
  if (summary.layout === 'reflowable') {
    return isDefault ? 'Reflowable (Default)' : 'Reflowable';
  }
  if (summary.title) {
    return summary.title;
  }
  if (summary.language) {
    return `Edition (${summary.language.toUpperCase()})`;
  }
  return isDefault ? 'Default Rendition' : `Rendition ${index + 1}`;
}

export interface ArchiveReaderLike {
  getText?: (path: string) => Promise<string | null>;
  has?: (path: string) => boolean;
}

/**
 * Resolves all valid renditions from container.xml, optionally reading package XML from archive to extract labels.
 * Ensures an invalid alternate rootfile does not block the valid default rendition.
 */
export async function resolveRenditions(
  containerXml: string,
  archive?: ArchiveReaderLike,
): Promise<RenditionItem[]> {
  const rawEntries = parseContainerXml(containerXml);
  const items: RenditionItem[] = [];

  for (let i = 0; i < rawEntries.length; i++) {
    const entry = rawEntries[i];
    if (!entry) continue;

    const isDefault = i === 0;

    let summary: PackageMetadataSummary = {};
    if (archive && typeof archive.getText === 'function') {
      try {
        const opfXml = await archive.getText(entry.fullPath);
        if (opfXml) {
          summary = extractOpfMetadataSummary(opfXml);
        } else if (!isDefault) {
          // If alternate package is missing from archive, omit it
          continue;
        }
      } catch {
        if (!isDefault) {
          // Skip invalid alternate package
          continue;
        }
      }
    }

    const label = deriveRenditionLabel(summary, i, isDefault);
    const id =
      entry.fullPath
        .split('/')
        .pop()
        ?.replace(/\.opf$/i, '') ?? `rendition-${i + 1}`;

    items.push({
      id,
      fullPath: entry.fullPath,
      mediaType: entry.mediaType,
      label,
      isDefault,
      layout: summary.layout,
      language: summary.language,
      title: summary.title,
    });
  }

  return items;
}

export interface BookContainerHost {
  container: {
    parse: (doc: Document) => Promise<{ fullPath: string; directory: string }>;
  };
  open: (input: Uint8Array | ArrayBuffer, openAs: string) => Promise<void>;
}

export async function openBookWithRootfile(
  book: BookContainerHost,
  data: Uint8Array | ArrayBuffer,
  requestedRootfile: string,
): Promise<void> {
  const container = book.container;
  const origParse = container.parse.bind(container);
  container.parse = async (doc: Document) => {
    const parsed = await origParse(doc);
    const targetNorm = requestedRootfile.replace(/^\//, '');
    const matched = Array.from(doc.querySelectorAll('rootfile')).find(
      (rf) => rf.getAttribute('full-path')?.replace(/^\//, '') === targetNorm,
    );
    if (matched) {
      parsed.fullPath = targetNorm;
      parsed.directory = targetNorm.includes('/')
        ? targetNorm.slice(0, targetNorm.lastIndexOf('/'))
        : '';
    }
    return parsed;
  };
  await book.open(data, 'binary');
}
