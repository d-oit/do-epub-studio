import { escapeXml } from './serializer';
import {
  attribute,
  closeTagStart,
  elementPrefix,
  hasToken,
  insertBefore,
  localName,
  parseXml,
  relativeArchiveHref,
  resolvePackageHref,
  type EpubPackageDocument,
  type EpubPackageUpdate,
} from './annotation-export-xml';

const XHTML_MEDIA_TYPE = 'application/xhtml+xml';

function directoryName(path: string): string {
  const separator = path.lastIndexOf('/');
  return separator < 0 ? '' : path.slice(0, separator);
}

function uniqueValue(base: string, exists: (value: string) => boolean): string {
  if (!exists(base)) return base;
  for (let suffix = 2; suffix <= 10_000; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!exists(candidate)) return candidate;
  }
  throw new TypeError('Could not allocate a unique EPUB annotation resource name');
}

function findTocListOffset(xml: string): { offset: number; prefix: string } {
  let tocDepth = 0;
  let listDepth = 0;
  let listOffset = -1;
  let listPrefix = '';
  parseXml(xml, 'EPUB navigation document', {
    open(tag, stack, depth) {
      const name = localName(tag.name);
      const parent = stack.length > 0 ? localName(stack[stack.length - 1] as string) : null;
      const type = attribute(tag, 'epub:type') ?? attribute(tag, 'type') ?? '';
      const role = attribute(tag, 'role') ?? '';
      if (
        name === 'nav' &&
        tocDepth === 0 &&
        (hasToken(type, 'toc') || hasToken(role, 'doc-toc'))
      ) {
        tocDepth = depth;
      }
      if (tocDepth > 0 && name === 'ol' && parent === 'nav' && depth === tocDepth + 1) {
        listDepth = depth;
        listPrefix = elementPrefix(tag.name);
      }
    },
    close(tag, _stack, depth, position) {
      const name = localName(tag.name);
      if (listDepth === depth && name === 'ol') {
        listOffset = closeTagStart(xml, tag.name, position);
        listDepth = 0;
      }
      if (tocDepth === depth && name === 'nav') tocDepth = 0;
    },
  });
  if (listOffset < 0) throw new TypeError('EPUB navigation document has no table of contents list');
  return { offset: listOffset, prefix: listPrefix };
}

function updateNavigationDocument(xml: string, href: string): string {
  const { offset, prefix } = findTocListOffset(xml);
  const item = `\n        <${prefix}li><${prefix}a href="${escapeXml(href)}">Annotations</${prefix}a></${prefix}li>\n      `;
  return insertBefore(xml, offset, item);
}

function updateNcxDocument(xml: string, href: string): string {
  let navMapDepth = 0;
  let navMapOffset = -1;
  let navMapPrefix = '';
  let playOrder = 0;
  const ids = new Set<string>();
  parseXml(xml, 'EPUB NCX document', {
    open(tag, stack, depth) {
      const name = localName(tag.name);
      const parent = stack.length > 0 ? localName(stack[stack.length - 1] as string) : null;
      if (depth === 1 && name !== 'ncx') throw new TypeError('EPUB NCX has no ncx root element');
      if (name === 'navMap' && parent === 'ncx' && navMapDepth === 0) {
        navMapDepth = depth;
        navMapPrefix = elementPrefix(tag.name);
      }
      const id = attribute(tag, 'id');
      if (id) ids.add(id);
      if (name === 'navPoint') {
        const value = attribute(tag, 'playOrder');
        if (value && value.length <= 10) {
          let parsed = 0;
          let valid = true;
          for (const character of value) {
            const digit = character.charCodeAt(0) - 48;
            if (digit < 0 || digit > 9) {
              valid = false;
              break;
            }
            parsed = parsed * 10 + digit;
          }
          if (valid && Number.isSafeInteger(parsed)) playOrder = Math.max(playOrder, parsed);
        }
      }
    },
    close(tag, _stack, depth, position) {
      if (depth === navMapDepth && localName(tag.name) === 'navMap') {
        navMapOffset = closeTagStart(xml, tag.name, position);
        navMapDepth = 0;
      }
    },
  });
  if (navMapOffset < 0) throw new TypeError('EPUB NCX has no navMap element');
  if (playOrder >= Number.MAX_SAFE_INTEGER)
    throw new TypeError('EPUB NCX playOrder is out of range');
  const id = uniqueValue('annotations-nav', (value) => ids.has(value));
  const navPoint = `\n    <${navMapPrefix}navPoint id="${escapeXml(id)}" playOrder="${playOrder + 1}">\n      <${navMapPrefix}navLabel><${navMapPrefix}text>Annotations</${navMapPrefix}text></${navMapPrefix}navLabel>\n      <${navMapPrefix}content src="${escapeXml(href)}"/>\n    </${navMapPrefix}navPoint>\n  `;
  return insertBefore(xml, navMapOffset, navPoint);
}

export function updatePackageForAnnotations(
  packageDocument: EpubPackageDocument,
  packagePath: string,
  archivePaths: ReadonlySet<string>,
  navXmlSource: string | null,
  ncxXmlSource: string | null,
): EpubPackageUpdate {
  const packageDirectory = directoryName(packagePath);
  const manifestPaths = new Set(
    packageDocument.manifestItems
      .map((item) => resolvePackageHref(item.href, packagePath))
      .filter((path): path is string => path !== null),
  );
  const appendixFile = uniqueValue('annotations', (name) => {
    const path = packageDirectory ? `${packageDirectory}/${name}.xhtml` : `${name}.xhtml`;
    return archivePaths.has(path) || manifestPaths.has(path);
  });
  const appendixPath = packageDirectory
    ? `${packageDirectory}/${appendixFile}.xhtml`
    : `${appendixFile}.xhtml`;
  const manifestIds = new Set(packageDocument.manifestItems.map((item) => item.id));
  const itemId = uniqueValue('annotations', (value) => manifestIds.has(value));
  const appendixHref = relativeArchiveHref(packagePath, appendixPath);
  const manifestItem = `\n    <${packageDocument.manifestPrefix}item id="${escapeXml(itemId)}" href="${escapeXml(appendixHref)}" media-type="${XHTML_MEDIA_TYPE}"/>\n  `;
  const spineItem = `\n    <${packageDocument.spinePrefix}itemref idref="${escapeXml(itemId)}"/>\n  `;
  const insertions = [
    { offset: packageDocument.manifestCloseOffset, value: manifestItem },
    { offset: packageDocument.spineCloseOffset, value: spineItem },
  ].sort((left, right) => right.offset - left.offset);
  let opfXml = packageDocument.xml;
  for (const insertion of insertions)
    opfXml = insertBefore(opfXml, insertion.offset, insertion.value);

  let navXml: string | null = null;
  const navPath = packageDocument.navPath;
  if (packageDocument.version.startsWith('3.')) {
    if (!navPath || !navXmlSource) throw new TypeError('EPUB 3 navigation document is missing');
    navXml = updateNavigationDocument(navXmlSource, relativeArchiveHref(navPath, appendixPath));
  }

  let ncxXml: string | null = null;
  const ncxPath = packageDocument.ncxPath;
  if (ncxPath) {
    if (!ncxXmlSource) throw new TypeError('EPUB NCX document is missing');
    ncxXml = updateNcxDocument(ncxXmlSource, relativeArchiveHref(ncxPath, appendixPath));
  }

  return { appendixPath, appendixHref, opfXml, navPath, navXml, ncxPath, ncxXml };
}
