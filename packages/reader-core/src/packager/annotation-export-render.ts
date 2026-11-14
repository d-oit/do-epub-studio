import { escapeXml } from './serializer';
import {
  normalizeArchivePath,
  relativeArchiveHref,
  resolvePackageHref,
  type EpubSpineTarget,
} from './annotation-export-xml';
import { encodeCfiFragment, parseCfiSpineIndex } from './annotation-export-cfi';
import { isValidLanguageTag, type EpubExportAnnotation } from './annotation-export-validate';

interface AnnotationTarget {
  href: string;
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

export function createAppendix(
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
