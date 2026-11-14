import { buildZip, type ZipEntry } from './zip';
import {
  getSpineTargets,
  normalizeArchivePath,
  parseContainerRootfile,
  parsePackageDocument,
  type EpubPackageDocument,
  type EpubPackageUpdate,
} from './annotation-export-xml';
import { updatePackageForAnnotations } from './annotation-export-navigation';
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
} from './annotation-export-archive';
import { validateAnnotations, type EpubExportAnnotation } from './annotation-export-validate';
import { createAppendix } from './annotation-export-render';

export { EpubAnnotationExportError, EPUB_ANNOTATION_EXPORT_LIMITS };
export type { EpubAnnotationExportErrorCode } from './annotation-export-archive';
export type { EpubExportAnnotation } from './annotation-export-validate';

const textEncoder = new TextEncoder();

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
