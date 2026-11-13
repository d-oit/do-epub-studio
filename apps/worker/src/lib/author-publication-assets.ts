import { MAX_AUTHOR_ASSET_COUNT, type AuthorPublication } from '@do-epub-studio/shared';
import { parseAuthorContent } from '@do-epub-studio/reader-core/author-content';
import { ValidationError } from './http-errors';

export type AuthorAssetKind = 'image' | 'stylesheet';
export function isValidAuthorAssetId(value: string): boolean {
  if (value.length !== 36) return false;

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (index === 8 || index === 13 || index === 18 || index === 23) {
      if (code !== 0x2d) return false;
      continue;
    }
    if (index === 14 && (code < 0x31 || code > 0x38)) return false;
    if (
      index === 19 &&
      code !== 0x38 &&
      code !== 0x39 &&
      code !== 0x61 &&
      code !== 0x62 &&
      code !== 0x41 &&
      code !== 0x42
    ) {
      return false;
    }
    const isDigit = code >= 0x30 && code <= 0x39;
    const isLowerHex = code >= 0x61 && code <= 0x66;
    const isUpperHex = code >= 0x41 && code <= 0x46;
    if (!isDigit && !isLowerHex && !isUpperHex) return false;
  }
  return true;
}

export function publicationAssetRequirements(
  publication: AuthorPublication,
): Map<string, AuthorAssetKind> {
  const requirements = new Map<string, AuthorAssetKind>();
  const requireAsset = (id: string, kind: AuthorAssetKind) => {
    const previousKind = requirements.get(id);
    if (previousKind && previousKind !== kind) {
      throw new ValidationError('An author asset cannot be both an image and a stylesheet');
    }
    requirements.set(id, kind);
  };

  if (publication.coverImageAssetId) requireAsset(publication.coverImageAssetId, 'image');
  for (const id of publication.stylesheetAssetIds) requireAsset(id, 'stylesheet');

  const pending = publication.chapters.flatMap((chapter) =>
    parseAuthorContent(chapter.contentHtml),
  );
  while (pending.length > 0) {
    const node = pending.pop();
    if (!node || node.type !== 'element') continue;
    if (node.tag === 'img') {
      const source = node.attributes.find((attribute) => attribute.name === 'src')?.value;
      if (source?.startsWith('asset:')) requireAsset(source.slice('asset:'.length), 'image');
    }
    pending.push(...node.children);
  }

  if (requirements.size > MAX_AUTHOR_ASSET_COUNT) {
    throw new ValidationError(
      `A manuscript may reference at most ${MAX_AUTHOR_ASSET_COUNT} assets`,
    );
  }
  return requirements;
}
