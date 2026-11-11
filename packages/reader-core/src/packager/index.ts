export { packageEpub3 } from './packager';
export type { PackagedAsset, PackagerOptions } from './packager';
export { buildZip, crc32 } from './zip';
export type { ZipEntry } from './zip';
export { escapeXml, sanitizeChapterXhtml } from './serializer';
export {
  exportAnnotationsToEpub,
  EpubAnnotationExportError,
  EPUB_ANNOTATION_EXPORT_LIMITS,
} from './annotation-export';
export type { EpubExportAnnotation, EpubAnnotationExportErrorCode } from './annotation-export';
