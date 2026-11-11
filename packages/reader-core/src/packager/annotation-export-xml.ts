import { SaxesParser } from 'saxes';

const XHTML_MEDIA_TYPE = 'application/xhtml+xml';
const NCX_MEDIA_TYPE = 'application/x-dtbncx+xml';
const MAX_XML_BYTES = 2 * 1024 * 1024;

export interface XmlTag {
  name: string;
  attributes: Record<string, string>;
}

export interface XmlHandlers {
  open?: (tag: XmlTag, stack: readonly string[], depth: number) => void;
  close?: (tag: XmlTag, stack: readonly string[], depth: number, position: number) => void;
  text?: (value: string, stack: readonly string[]) => void;
}

export interface ManifestItem {
  id: string;
  href: string;
  mediaType: string;
  properties: string;
}

export interface SpineItem {
  idref: string;
}

export interface EpubPackageDocument {
  xml: string;
  version: string;
  manifestItems: ManifestItem[];
  spineItems: SpineItem[];
  manifestPrefix: string;
  spinePrefix: string;
  manifestCloseOffset: number;
  spineCloseOffset: number;
  language: string;
  navPath: string | null;
  ncxPath: string | null;
}

export interface EpubSpineTarget {
  index: number;
  path: string;
  idref: string;
}

export interface EpubPackageUpdate {
  appendixPath: string;
  appendixHref: string;
  opfXml: string;
  navPath: string | null;
  navXml: string | null;
  ncxPath: string | null;
  ncxXml: string | null;
}

export function localName(name: string): string {
  const separator = name.lastIndexOf(':');
  return separator < 0 ? name : name.slice(separator + 1);
}

export function elementPrefix(name: string): string {
  const separator = name.lastIndexOf(':');
  return separator < 0 ? '' : name.slice(0, separator + 1);
}

function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && index + 1 < value.length) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        index += 1;
      } else bytes += 3;
    } else bytes += 3;
  }
  return bytes;
}

export function attribute(tag: XmlTag, name: string): string | null {
  const value = tag.attributes[name];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function hasToken(value: string, token: string): boolean {
  let start = 0;
  for (let index = 0; index <= value.length; index++) {
    const character = value[index];
    const whitespace =
      character === undefined ||
      character === ' ' ||
      character === '\t' ||
      character === '\r' ||
      character === '\n';
    if (!whitespace) continue;
    if (value.slice(start, index) === token) return true;
    start = index + 1;
  }
  return false;
}

export function parseXml(xml: string, fileName: string, handlers: XmlHandlers): void {
  const stack: string[] = [];
  let parseError: Error | null = null;
  const parser = new SaxesParser({ xmlns: false, position: true, fileName });
  parser.on('error', (error) => {
    parseError ??= error;
  });
  parser.on('doctype', (doctype) => {
    if (doctype.includes('[')) {
      parseError ??= new Error(`${fileName} must not declare internal entities`);
    }
  });
  parser.on('opentag', (tag) => {
    if (parseError) return;
    const depth = stack.length + 1;
    handlers.open?.(tag, stack, depth);
    stack.push(tag.name);
  });
  parser.on('text', (text) => {
    if (!parseError) handlers.text?.(text, stack);
  });
  parser.on('cdata', (text) => {
    if (!parseError) handlers.text?.(text, stack);
  });
  parser.on('closetag', (tag) => {
    if (parseError) return;
    const depth = stack.length;
    if (stack[depth - 1] !== tag.name) {
      parseError = new Error(`${fileName} has mismatched XML elements`);
      return;
    }
    handlers.close?.(tag, stack, depth, parser.position);
    stack.pop();
  });

  try {
    parser.write(xml).close();
  } catch (error) {
    parseError ??= error instanceof Error ? error : new Error(String(error));
  }
  if (parseError) throw new TypeError(`Invalid ${fileName}: ${parseError.message}`);
  if (stack.length > 0) throw new TypeError(`Invalid ${fileName}: unclosed XML elements`);
}

export function closeTagStart(xml: string, tagName: string, parserPosition: number): number {
  const marker = `</${tagName}`;
  const offset = xml.lastIndexOf(marker, parserPosition);
  const next = xml[offset + marker.length];
  if (
    offset < 0 ||
    (next !== '>' && next !== ' ' && next !== '\t' && next !== '\r' && next !== '\n')
  ) {
    throw new TypeError(`Could not locate closing ${tagName} tag`);
  }
  return offset;
}

export function insertBefore(xml: string, offset: number, value: string): string {
  return `${xml.slice(0, offset)}${value}${xml.slice(offset)}`;
}

export function normalizeArchivePath(reference: string, baseDirectory = ''): string | null {
  if (
    reference.length === 0 ||
    reference.startsWith('/') ||
    reference.startsWith('\\') ||
    reference.includes('\\') ||
    reference.includes('?') ||
    reference.includes('#')
  ) {
    return null;
  }

  const segments = baseDirectory ? baseDirectory.split('/') : [];
  for (const encodedSegment of reference.split('/')) {
    if (encodedSegment.length === 0) return null;
    let segment: string;
    try {
      segment = decodeURIComponent(encodedSegment);
    } catch {
      return null;
    }
    if (
      segment.length === 0 ||
      segment.includes('/') ||
      segment.includes('\\') ||
      segment.includes('\0') ||
      segment.includes(':') ||
      segment.includes('?') ||
      segment.includes('#')
    ) {
      return null;
    }
    if (segment === '.') continue;
    if (segment === '..') {
      if (segments.length === 0) return null;
      segments.pop();
      continue;
    }
    segments.push(segment);
  }
  return segments.length > 0 ? segments.join('/') : null;
}

function directoryName(path: string): string {
  const separator = path.lastIndexOf('/');
  return separator < 0 ? '' : path.slice(0, separator);
}

export function resolvePackageHref(href: string, packagePath: string): string | null {
  return normalizeArchivePath(href, directoryName(packagePath));
}

export function relativeArchiveHref(fromPath: string, targetPath: string): string {
  const fromDirectory = directoryName(fromPath).split('/').filter(Boolean);
  const target = targetPath.split('/');
  let common = 0;
  while (
    common < fromDirectory.length &&
    common < target.length - 1 &&
    fromDirectory[common] === target[common]
  ) {
    common += 1;
  }
  const relative = [...fromDirectory.slice(common).map(() => '..'), ...target.slice(common)];
  return relative
    .map((segment) => (segment === '..' ? segment : encodeURIComponent(segment)))
    .join('/');
}

export function parseContainerRootfile(xml: string): string {
  if (utf8ByteLength(xml) > MAX_XML_BYTES) {
    throw new TypeError('EPUB container.xml exceeds the XML size limit');
  }
  let rootfile: string | null = null;
  parseXml(xml, 'EPUB container.xml', {
    open(tag, stack, depth) {
      const name = localName(tag.name);
      const parent = stack.length > 0 ? localName(stack[stack.length - 1] as string) : null;
      if (depth === 1 && name !== 'container') {
        throw new TypeError('EPUB container.xml has no container root element');
      }
      if (name === 'rootfile' && parent === 'rootfiles' && rootfile === null) {
        rootfile = attribute(tag, 'full-path');
      }
    },
  });
  if (!rootfile) throw new TypeError('EPUB container.xml has no rootfile');
  return rootfile;
}

export function parsePackageDocument(xml: string, packagePath: string): EpubPackageDocument {
  if (utf8ByteLength(xml) > MAX_XML_BYTES) {
    throw new TypeError('EPUB package document exceeds the XML size limit');
  }
  const manifestItems: ManifestItem[] = [];
  const spineItems: SpineItem[] = [];
  let version = '';
  let packageSeen = false;
  let manifestCloseOffset = -1;
  let spineCloseOffset = -1;
  let manifestPrefix = '';
  let spinePrefix = '';
  let languageDepth = 0;
  let languageBuffer = '';
  let language = 'en';
  let navPath: string | null = null;
  let ncxPath: string | null = null;

  parseXml(xml, `EPUB package document ${packagePath}`, {
    open(tag, stack, depth) {
      const name = localName(tag.name);
      const parent = stack.length > 0 ? localName(stack[stack.length - 1] as string) : null;
      if (depth === 1) {
        if (name !== 'package') throw new TypeError('EPUB package document has no package root');
        packageSeen = true;
        version = attribute(tag, 'version') ?? '';
      }
      if (name === 'manifest' && parent === 'package') manifestPrefix = elementPrefix(tag.name);
      if (name === 'spine' && parent === 'package') spinePrefix = elementPrefix(tag.name);
      if (name === 'manifest' && parent === 'package' && manifestCloseOffset !== -1) {
        throw new TypeError('EPUB package document has duplicate manifests');
      }
      if (name === 'spine' && parent === 'package' && spineCloseOffset !== -1) {
        throw new TypeError('EPUB package document has duplicate spines');
      }
      if (name === 'item' && parent === 'manifest') {
        const id = attribute(tag, 'id');
        const href = attribute(tag, 'href');
        const mediaType = attribute(tag, 'media-type');
        if (!id || !href || !mediaType) throw new TypeError('EPUB manifest item is incomplete');
        manifestItems.push({
          id,
          href,
          mediaType,
          properties: attribute(tag, 'properties') ?? '',
        });
      }
      if (name === 'itemref' && parent === 'spine') {
        const idref = attribute(tag, 'idref');
        if (!idref) throw new TypeError('EPUB spine itemref has no idref');
        spineItems.push({ idref });
      }
      if (name === 'language' && parent === 'metadata' && languageDepth === 0) {
        languageDepth = depth;
        languageBuffer = '';
      }
    },
    text(value) {
      if (languageDepth > 0 && languageBuffer.length < 128) {
        languageBuffer += value.slice(0, 128 - languageBuffer.length);
      }
    },
    close(tag, stack, depth, position) {
      const name = localName(tag.name);
      const parent = depth > 1 ? localName(stack[depth - 2] as string) : null;
      if (name === 'manifest' && parent === 'package') {
        if (manifestCloseOffset !== -1)
          throw new TypeError('EPUB package document has duplicate manifests');
        manifestCloseOffset = closeTagStart(xml, tag.name, position);
      }
      if (name === 'spine' && parent === 'package') {
        if (spineCloseOffset !== -1)
          throw new TypeError('EPUB package document has duplicate spines');
        spineCloseOffset = closeTagStart(xml, tag.name, position);
      }
      if (name === 'language' && depth === languageDepth && languageDepth > 0) {
        language = languageBuffer.trim() || 'en';
        languageDepth = 0;
      }
    },
  });

  if (!packageSeen || (version !== '2.0' && !version.startsWith('3.'))) {
    throw new TypeError(`Unsupported EPUB package version: ${version || 'missing'}`);
  }
  if (manifestCloseOffset < 0 || spineCloseOffset < 0 || manifestItems.length === 0) {
    throw new TypeError('EPUB package document is missing its manifest or spine');
  }

  const ids = new Set<string>();
  for (const item of manifestItems) {
    if (ids.has(item.id)) throw new TypeError('EPUB manifest contains duplicate item IDs');
    ids.add(item.id);
    const path = resolvePackageHref(item.href, packagePath);
    if (hasToken(item.properties, 'nav')) {
      if (navPath) throw new TypeError('EPUB package document has multiple navigation documents');
      if (path && item.mediaType === XHTML_MEDIA_TYPE) navPath = path;
    }
    if (item.mediaType === NCX_MEDIA_TYPE) {
      if (ncxPath) throw new TypeError('EPUB package document has multiple NCX documents');
      if (path) ncxPath = path;
    }
  }
  for (const item of spineItems) {
    if (!ids.has(item.idref)) throw new TypeError('EPUB spine references an unknown manifest item');
  }
  if (version.startsWith('3.') && !navPath) {
    throw new TypeError('EPUB 3 package has no resolvable navigation document');
  }
  if (version === '2.0' && !ncxPath) {
    throw new TypeError('EPUB 2 package has no resolvable NCX navigation document');
  }

  return {
    xml,
    version,
    manifestItems,
    spineItems,
    manifestPrefix,
    spinePrefix,
    manifestCloseOffset,
    spineCloseOffset,
    language,
    navPath,
    ncxPath,
  };
}

export function getSpineTargets(
  packageDocument: EpubPackageDocument,
  packagePath: string,
): EpubSpineTarget[] {
  const manifestById = new Map(packageDocument.manifestItems.map((item) => [item.id, item]));
  const targets: EpubSpineTarget[] = [];
  packageDocument.spineItems.forEach((spineItem, index) => {
    const manifestItem = manifestById.get(spineItem.idref);
    if (!manifestItem || manifestItem.mediaType !== XHTML_MEDIA_TYPE) return;
    const path = resolvePackageHref(manifestItem.href, packagePath);
    if (path) targets.push({ index, path, idref: spineItem.idref });
  });
  return targets;
}
