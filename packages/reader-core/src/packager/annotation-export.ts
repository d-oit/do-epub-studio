import { escapeXml } from './serializer';
import { buildZip, type ZipEntry } from './zip';
import {
  getSpineTargets,
  normalizeArchivePath,
  parseContainerRootfile,
  parsePackageDocument,
  relativeArchiveHref,
  resolvePackageHref,
  type EpubPackageDocument,
  type EpubPackageUpdate,
  type EpubSpineTarget,
} from './annotation-export-xml';
import { updatePackageForAnnotations } from './annotation-export-navigation';
import { encodeCfiFragment, parseCfiSpineIndex } from './annotation-export-cfi';
import {
  EpubAnnotationExportError,
  EPUB_ANNOTATION_EXPORT_LIMITS,
  OUTPUT_MAX_COMPRESSED_BYTES,
  OUTPUT_MAX_UNCOMPRESSED_BYTES,
  archiveFailure,
  decodeXml,
  getXmlSource,
  isMimetype,
  unzipSource,
  validateSourceArchive,
  utf8ByteLength,
} from './annotation-export-archive';

export { EpubAnnotationExportError, EPUB_ANNOTATION_EXPORT_LIMITS };
export type { EpubAnnotationExportErrorCode } from './annotation-export-archive';

const MAX_ANNOTATIONS = EPUB_ANNOTATION_EXPORT_LIMITS.maxAnnotations;
const MAX_ANNOTATION_TEXT_BYTES = EPUB_ANNOTATION_EXPORT_LIMITS.maxAnnotationTextBytes;

export interface EpubExportAnnotation {
  id: string;
  type: 'highlight' | 'comment' | 'bookmark';
  body: string;
  selectedText?: string | null;
  note?: string | null;
  label?: string | null;
  chapterRef?: string | null;
  cfi?: string | null;
  revisionId?: string | null;
  anchorStatus?: string | null;
  originalChapterRef?: string | null;
  originalCfi?: string | null;
  originalSelectedText?: string | null;
  parentCommentId?: string | null;
  locatorContext?: string | null;
}

interface AnnotationTarget {
  href: string;
}

const textEncoder = new TextEncoder();

function isValidLanguageTag(value: string): boolean {
  if (value.length === 0 || value.length > 63) return false;
  const first = value.charCodeAt(0);
  if (!((first >= 65 && first <= 90) || (first >= 97 && first <= 122))) return false;
  let previousHyphen = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index] as string;
    const code = character.charCodeAt(0);
    const letter = (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
    const digit = code >= 48 && code <= 57;
    if (character === '-') {
      if (previousHyphen || index === value.length - 1) return false;
      previousHyphen = true;
    } else if (letter || digit) previousHyphen = false;
    else return false;
  }
  return true;
}

function isReadonlyArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

function validateAnnotations(annotations: readonly EpubExportAnnotation[]): void {
  if (!isReadonlyArray(annotations)) {
    throw new EpubAnnotationExportError(
      'ANNOTATIONS_INVALID',
      'Annotation records must be an array',
    );
  }
  if (annotations.length > MAX_ANNOTATIONS) {
    throw new EpubAnnotationExportError(
      'ANNOTATIONS_TOO_LARGE',
      'Exports support at most 500 annotations',
    );
  }
  const ids = new Set<string>();
  let textBytes = 0;
  for (const annotation of annotations) {
    if (!annotation || typeof annotation !== 'object') {
      throw new EpubAnnotationExportError(
        'ANNOTATIONS_INVALID',
        'An annotation record is malformed',
      );
    }
    if (
      (annotation.type !== 'highlight' &&
        annotation.type !== 'comment' &&
        annotation.type !== 'bookmark') ||
      typeof annotation.id !== 'string' ||
      annotation.id.length === 0 ||
      annotation.id.length > 128 ||
      typeof annotation.body !== 'string' ||
      ids.has(annotation.id)
    ) {
      throw new EpubAnnotationExportError(
        'ANNOTATIONS_INVALID',
        'An annotation record is malformed',
      );
    }
    for (const value of [
      annotation.revisionId,
      annotation.anchorStatus,
      annotation.parentCommentId,
    ]) {
      if (value !== undefined && value !== null && typeof value !== 'string') {
        throw new EpubAnnotationExportError(
          'ANNOTATIONS_INVALID',
          'An annotation metadata field is malformed',
        );
      }
    }
    if (
      (annotation.revisionId?.length ?? 0) > 128 ||
      (annotation.anchorStatus?.length ?? 0) > 32 ||
      (annotation.parentCommentId?.length ?? 0) > 128 ||
      (annotation.chapterRef?.length ?? 0) > 2048 ||
      (annotation.originalChapterRef?.length ?? 0) > 2048 ||
      (annotation.cfi?.length ?? 0) > 2048 ||
      (annotation.originalCfi?.length ?? 0) > 2048
    ) {
      throw new EpubAnnotationExportError(
        'ANNOTATIONS_INVALID',
        'An annotation metadata field exceeds its size limit',
      );
    }
    ids.add(annotation.id);
    for (const value of [
      annotation.body,
      annotation.selectedText,
      annotation.note,
      annotation.label,
      annotation.chapterRef,
      annotation.cfi,
      annotation.originalChapterRef,
      annotation.originalCfi,
      annotation.originalSelectedText,
      annotation.locatorContext,
    ]) {
      if (value !== undefined && value !== null && typeof value !== 'string') {
        throw new EpubAnnotationExportError(
          'ANNOTATIONS_INVALID',
          'An annotation text field is malformed',
        );
      }
      if (typeof value === 'string') textBytes += utf8ByteLength(value);
    }
  }
  if (textBytes > MAX_ANNOTATION_TEXT_BYTES) {
    throw new EpubAnnotationExportError(
      'ANNOTATIONS_TOO_LARGE',
      'Annotation text exceeds the 1 MiB export limit',
    );
  }
}

function findSpineByRef(
  reference: string | null | undefined,
  packagePath: string,
  spineTargets: readonly EpubSpineTarget[],
): EpubSpineTarget | null {
  if (!reference || reference.length > 2048) return null;
  const candidates = new Set<string>();
  const packageRelative = resolvePackageHref(reference, packagePath);
  const archiveRelative = normalizeArchivePath(reference);
  if (packageRelative) candidates.add(packageRelative);
  if (archiveRelative) candidates.add(archiveRelative);
  const matches = new Map<number, EpubSpineTarget>();
  for (const target of spineTargets) {
    if (target.idref === reference || candidates.has(target.path))
      matches.set(target.index, target);
  }
  return matches.size === 1 ? (matches.values().next().value ?? null) : null;
}

function resolveAnnotationTarget(
  annotation: EpubExportAnnotation,
  packagePath: string,
  appendixPath: string,
  sourceRevisionId: string | null,
  spineTargets: readonly EpubSpineTarget[],
): AnnotationTarget | null {
  if (
    annotation.revisionId !== undefined &&
    annotation.revisionId !== null &&
    annotation.revisionId !== sourceRevisionId
  ) {
    return null;
  }
  if (
    annotation.anchorStatus &&
    annotation.anchorStatus !== 'anchored' &&
    annotation.anchorStatus !== 'migrated'
  ) {
    return null;
  }

  const referenceTarget = findSpineByRef(annotation.chapterRef, packagePath, spineTargets);
  if (annotation.cfi !== undefined && annotation.cfi !== null) {
    if (annotation.cfi.length === 0) return null;
    const spineIndex = parseCfiSpineIndex(annotation.cfi);
    if (spineIndex === null) return null;
    const cfiTarget = spineTargets.find((target) => target.index === spineIndex);
    if (!cfiTarget || (referenceTarget && referenceTarget.index !== cfiTarget.index)) return null;
    const packageHref = relativeArchiveHref(appendixPath, packagePath);
    return {
      href: `${packageHref}#${encodeCfiFragment(annotation.cfi)}`,
    };
  }
  if (!referenceTarget) return null;
  return {
    href: relativeArchiveHref(appendixPath, referenceTarget.path),
  };
}

function renderAnnotation(
  annotation: EpubExportAnnotation,
  index: number,
  indicesById: ReadonlyMap<string, number>,
  target: AnnotationTarget | null,
): string {
  const typeLabel =
    annotation.type === 'highlight'
      ? 'Highlight'
      : annotation.type === 'comment'
        ? 'Comment'
        : 'Bookmark';
  const sections = [`<li id="annotation-${index + 1}"><h2>${typeLabel} ${index + 1}</h2>`];
  if (target) {
    sections.push(`<p><a href="${escapeXml(target.href)}">Open source location</a></p>`);
  } else {
    sections.push('<p><strong>Location unresolved</strong></p>');
  }
  if (!target && annotation.revisionId) {
    sections.push(
      `<p><strong>Recorded revision ID:</strong> ${escapeXml(annotation.revisionId)}</p>`,
    );
  }
  if (!target && annotation.cfi) {
    sections.push(`<p><strong>Stored CFI:</strong> ${escapeXml(annotation.cfi)}</p>`);
  }

  const chapter = annotation.chapterRef ?? annotation.originalChapterRef;
  if (chapter) sections.push(`<p><strong>Chapter reference:</strong> ${escapeXml(chapter)}</p>`);
  if (annotation.originalChapterRef && annotation.originalChapterRef !== annotation.chapterRef) {
    sections.push(
      `<p><strong>Original chapter:</strong> ${escapeXml(annotation.originalChapterRef)}</p>`,
    );
  }
  if (annotation.originalCfi && annotation.originalCfi !== annotation.cfi) {
    sections.push(`<p><strong>Original CFI:</strong> ${escapeXml(annotation.originalCfi)}</p>`);
  }
  const passage = annotation.selectedText || annotation.originalSelectedText;
  if (passage) sections.push(`<blockquote><p>${escapeXml(passage)}</p></blockquote>`);
  if (
    annotation.originalSelectedText &&
    annotation.originalSelectedText !== annotation.selectedText
  ) {
    sections.push(
      `<p><strong>Original passage:</strong> ${escapeXml(annotation.originalSelectedText)}</p>`,
    );
  }

  if (annotation.type === 'highlight') {
    const note = annotation.note ?? annotation.body;
    if (note) sections.push(`<p><strong>Note:</strong> ${escapeXml(note)}</p>`);
  } else if (annotation.type === 'comment') {
    if (annotation.body) sections.push(`<p>${escapeXml(annotation.body)}</p>`);
    if (annotation.parentCommentId) {
      const parentIndex = indicesById.get(annotation.parentCommentId);
      if (parentIndex !== undefined) {
        sections.push(
          `<p>Reply to <a href="#annotation-${parentIndex}">comment ${parentIndex}</a></p>`,
        );
      }
    }
  } else {
    const label = annotation.label ?? annotation.body;
    if (label) sections.push(`<p><strong>Bookmark:</strong> ${escapeXml(label)}</p>`);
    if (annotation.locatorContext) {
      sections.push(
        `<p><strong>Stored locator (unparsed):</strong> ${escapeXml(annotation.locatorContext)}</p>`,
      );
    }
  }
  sections.push('</li>');
  return sections.join('');
}

function createAppendix(
  annotations: readonly EpubExportAnnotation[],
  packagePath: string,
  appendixPath: string,
  packageVersion: string,
  language: string,
  revisionId: string | null,
  spineTargets: readonly EpubSpineTarget[],
): string {
  const indicesById = new Map(annotations.map((annotation, index) => [annotation.id, index + 1]));
  const items = annotations
    .map((annotation, index) => {
      const target = resolveAnnotationTarget(
        annotation,
        packagePath,
        appendixPath,
        revisionId,
        spineTargets,
      );
      return renderAnnotation(annotation, index, indicesById, target);
    })
    .join('\n');
  const safeLanguage = isValidLanguageTag(language) ? language : 'en';
  const isEpub3 = packageVersion.startsWith('3.');
  const epubNamespace = isEpub3 ? ' xmlns:epub="http://www.idpf.org/2007/ops"' : '';
  const appendixAttributes = isEpub3
    ? ' epub:type="appendix" role="doc-appendix"'
    : ' class="appendix"';
  const charsetMetadata = isEpub3
    ? '<meta charset="utf-8"/>'
    : '<meta http-equiv="Content-Type" content="application/xhtml+xml; charset=utf-8"/>';
  return `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml"${epubNamespace} lang="${escapeXml(safeLanguage)}" xml:lang="${escapeXml(safeLanguage)}">
  <head>
    <title>Annotations</title>
    ${charsetMetadata}
  </head>
  <body>
    <div id="annotations"${appendixAttributes}>
      <h1>Annotations</h1>
      <ol>
${items}
      </ol>
    </div>
  </body>
</html>`;
}

export async function exportAnnotationsToEpub(
  sourceBytes: Uint8Array,
  annotations: readonly EpubExportAnnotation[],
  options: { revisionId: string | null },
): Promise<Uint8Array<ArrayBuffer>> {
  await validateSourceArchive(sourceBytes);
  validateAnnotations(annotations);
  const unzipped = await unzipSource(sourceBytes);
  const sourceEntries = unzipped.entries;
  const mimetype = sourceEntries[0];
  if (
    !mimetype ||
    mimetype.name !== 'mimetype' ||
    mimetype.compression !== 0 ||
    !isMimetype(mimetype.data)
  ) {
    throw new EpubAnnotationExportError(
      'SOURCE_INVALID',
      'The source EPUB has an invalid mimetype entry',
    );
  }
  const entriesByName = new Map(sourceEntries.map((entry) => [entry.name, entry]));
  const archivePaths = new Set(entriesByName.keys());
  const container = entriesByName.get('META-INF/container.xml');
  if (!container)
    throw new EpubAnnotationExportError('SOURCE_INVALID', 'The source EPUB has no container.xml');

  let packagePath: string;
  let packageDocument: EpubPackageDocument;
  let navXmlSource: string | null;
  let ncxXmlSource: string | null;
  try {
    const rootfile = parseContainerRootfile(decodeXml(container.data, 'META-INF/container.xml'));
    const normalizedRootfile = normalizeArchivePath(rootfile);
    if (!normalizedRootfile || !entriesByName.has(normalizedRootfile)) {
      throw new TypeError('The source EPUB rootfile path is unsafe or missing');
    }
    packagePath = normalizedRootfile;
    const packageEntry = entriesByName.get(packagePath);
    if (!packageEntry) throw new TypeError('The source EPUB package document is missing');
    const packageXml = decodeXml(packageEntry.data, 'EPUB package document');
    packageDocument = parsePackageDocument(packageXml, packagePath);
    navXmlSource = getXmlSource(entriesByName, packageDocument.navPath, 'EPUB navigation document');
    ncxXmlSource = getXmlSource(entriesByName, packageDocument.ncxPath, 'EPUB NCX document');
  } catch (error) {
    throw archiveFailure(error);
  }

  let update: EpubPackageUpdate;
  try {
    update = updatePackageForAnnotations(
      packageDocument,
      packagePath,
      archivePaths,
      navXmlSource,
      ncxXmlSource,
    );
  } catch (error) {
    throw archiveFailure(error);
  }
  const appendix = textEncoder.encode(
    createAppendix(
      annotations,
      packagePath,
      update.appendixPath,
      packageDocument.version,
      packageDocument.language,
      options.revisionId,
      getSpineTargets(packageDocument, packagePath),
    ),
  );
  const replacements = new Map<string, Uint8Array>([
    [packagePath, textEncoder.encode(update.opfXml)],
  ]);
  if (update.navPath && update.navXml !== null) {
    replacements.set(update.navPath, textEncoder.encode(update.navXml));
  }
  if (update.ncxPath && update.ncxXml !== null) {
    replacements.set(update.ncxPath, textEncoder.encode(update.ncxXml));
  }

  let outputExpandedBytes = unzipped.expandedBytes + appendix.byteLength;
  for (const [path, replacement] of replacements) {
    const original = entriesByName.get(path);
    if (!original)
      throw new EpubAnnotationExportError('SOURCE_INVALID', `The source EPUB is missing ${path}`);
    outputExpandedBytes += replacement.byteLength - original.data.byteLength;
  }
  if (outputExpandedBytes > OUTPUT_MAX_UNCOMPRESSED_BYTES) {
    throw new EpubAnnotationExportError(
      'OUTPUT_TOO_LARGE',
      'The exported EPUB exceeds the 24 MiB expanded limit',
    );
  }

  const outputEntries: ZipEntry[] = sourceEntries.map((entry) => ({
    name: entry.name,
    data: replacements.get(entry.name) ?? entry.data,
    ...(entry.name === 'mimetype' ? { store: true } : {}),
  }));
  outputEntries.push({ name: update.appendixPath, data: appendix });
  try {
    return await buildZip(outputEntries, { maxOutputBytes: OUTPUT_MAX_COMPRESSED_BYTES });
  } catch (error) {
    if (error instanceof RangeError) {
      throw new EpubAnnotationExportError('OUTPUT_TOO_LARGE', error.message);
    }
    throw new EpubAnnotationExportError(
      'SOURCE_INVALID',
      `Could not package the annotated EPUB: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
