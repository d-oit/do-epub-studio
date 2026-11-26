import { buildZip, ZipOutputLimitError, type ZipEntry } from './zip';
import {
  getSpineTargets,
  normalizeArchivePath,
  parseContainerRootfile,
  parsePackageDocument,
  resolvePackageHref,
  validateEncryptionFile,
  type EpubPackageDocument,
  type EpubPackageUpdate,
} from './annotation-export-xml';
import { updatePackageForAnnotations } from './annotation-export-navigation';
import {
  EpubAnnotationExportError,
  EPUB_ANNOTATION_EXPORT_LIMITS,
  MAX_CONTAINER_XML_BYTES,
  OUTPUT_MAX_COMPRESSED_BYTES,
  OUTPUT_MAX_UNCOMPRESSED_BYTES,
  archiveFailure,
  decodeXml,
  getXmlSource,
  isMimetype,
  unzipSource,
  validateOutputArchive,
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
  if (entriesByName.has('META-INF/signatures.xml')) {
    throw new EpubAnnotationExportError(
      'SIGNATURES_UNSUPPORTED',
      'Signed EPUB sources cannot be re-exported',
    );
  }
  if (entriesByName.has('META-INF/license.lcpl') || entriesByName.has('META-INF/rights.xml')) {
    throw new EpubAnnotationExportError(
      'ENCRYPTION_UNSUPPORTED',
      'DRM-protected EPUB sources cannot be re-exported',
    );
  }
  const encryptionEntry = entriesByName.get('META-INF/encryption.xml');
  if (encryptionEntry) {
    try {
      validateEncryptionFile(encryptionEntry.data);
    } catch (error) {
      if (error instanceof EpubAnnotationExportError) throw error;
      throw new EpubAnnotationExportError(
        'SOURCE_INVALID',
        `The source EPUB encryption document is not safe: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
  const container = entriesByName.get('META-INF/container.xml');
  if (!container)
    throw new EpubAnnotationExportError('SOURCE_INVALID', 'The source EPUB has no container.xml');
  let packagePath: string;
  let packageDocument: EpubPackageDocument;
  let navXmlSource: string | null;
  let ncxXmlSource: string | null;
  try {
    const rootfile = parseContainerRootfile(
      decodeXml(container.data, 'META-INF/container.xml', MAX_CONTAINER_XML_BYTES),
    );
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
      packageDocument.spineStep,
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
    store: true,
  }));
  outputEntries.push({ name: update.appendixPath, data: appendix, store: true });
  let epub: Uint8Array<ArrayBuffer>;
  try {
    epub = await buildZip(outputEntries, { maxOutputBytes: OUTPUT_MAX_COMPRESSED_BYTES });
  } catch (error) {
    if (error instanceof ZipOutputLimitError) {
      throw new EpubAnnotationExportError('OUTPUT_TOO_LARGE', error.message);
    }
    throw new EpubAnnotationExportError(
      'SOURCE_INVALID',
      `Could not package the annotated EPUB: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  await verifyOutputStructure(epub, update);
  return epub;
}

/**
 * Re-run archive safety and the bounded package/structure parser on the exact
 * output bytes so the returned EPUB is re-parsed for conformance before it
 * leaves reader-core. The shared regex-based validator is not used here.
 */
async function verifyOutputStructure(
  bytes: Uint8Array<ArrayBuffer>,
  update: EpubPackageUpdate,
): Promise<void> {
  await validateOutputArchive(bytes);
  try {
    const unzipped = await unzipSource(bytes);
    const entries = new Map(unzipped.entries.map((entry) => [entry.name, entry]));
    if (!entries.has(update.appendixPath)) {
      throw new TypeError('The exported EPUB is missing the annotation appendix');
    }
    const container = entries.get('META-INF/container.xml');
    if (!container) throw new TypeError('The exported EPUB has no container.xml');
    const rootfile = parseContainerRootfile(
      decodeXml(container.data, 'META-INF/container.xml', MAX_CONTAINER_XML_BYTES),
    );
    const normalizedRootfile = normalizeArchivePath(rootfile);
    if (!normalizedRootfile || !entries.has(normalizedRootfile)) {
      throw new TypeError('The exported EPUB rootfile path is unsafe or missing');
    }
    const packageDocument = parsePackageDocument(
      decodeXml(entries.get(normalizedRootfile)?.data ?? new Uint8Array(), 'EPUB package document'),
      normalizedRootfile,
    );
    const manifestById = new Map(packageDocument.manifestItems.map((item) => [item.id, item]));
    const appendixItem = manifestById.get(update.itemId);
    if (
      !appendixItem ||
      resolvePackageHref(appendixItem.href, normalizedRootfile) !== update.appendixPath ||
      !packageDocument.spineItems.some((item) => item.idref === update.itemId)
    ) {
      throw new TypeError('The exported EPUB appendix is not linked from its package');
    }
    if (packageDocument.version.startsWith('3.')) {
      if (!getXmlSource(entries, packageDocument.navPath, 'EPUB navigation document')) {
        throw new TypeError('The exported EPUB 3 navigation document is missing');
      }
    } else if (!getXmlSource(entries, packageDocument.ncxPath, 'EPUB NCX document')) {
      throw new TypeError('The exported EPUB 2 NCX document is missing');
    }
  } catch (error) {
    throw archiveFailure(error);
  }
}
