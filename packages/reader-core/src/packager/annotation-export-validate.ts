import {
  EpubAnnotationExportError,
  EPUB_ANNOTATION_EXPORT_LIMITS,
  utf8ByteLength,
} from './annotation-export-archive';

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

export function isValidLanguageTag(value: string): boolean {
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

export function validateAnnotations(annotations: readonly EpubExportAnnotation[]): void {
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
