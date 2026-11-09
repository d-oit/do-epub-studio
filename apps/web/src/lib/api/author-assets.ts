import type { AuthorAssetMetadata } from '@do-epub-studio/shared';
import { apiRequest } from './core';

interface AssetEnvelope {
  asset: AuthorAssetMetadata;
}

function assetPath(bookId: string, assetId?: string): string {
  const base = `/api/author/books/${encodeURIComponent(bookId)}/assets`;
  return assetId ? `${base}/${encodeURIComponent(assetId)}` : base;
}

export async function listAuthorAssets(
  bookId: string,
  token?: string | null,
): Promise<AuthorAssetMetadata[]> {
  const result = await apiRequest<{ assets: AuthorAssetMetadata[] }>(assetPath(bookId), {
    token: token ?? undefined,
  });
  return result.assets;
}

export async function uploadAuthorAsset(
  bookId: string,
  assetId: string,
  file: File,
  token?: string | null,
): Promise<AuthorAssetMetadata> {
  const result = await apiRequest<AssetEnvelope>(assetPath(bookId, assetId), {
    method: 'PUT',
    token: token ?? undefined,
    headers: {
      'Content-Type': file.type,
      'X-Asset-Name': encodeURIComponent(file.name),
    },
    body: file,
  });
  return result.asset;
}

export async function fetchAuthorAsset(
  bookId: string,
  asset: Pick<AuthorAssetMetadata, 'id' | 'mediaType'>,
  token?: string | null,
): Promise<Blob> {
  const data = await apiRequest<ArrayBuffer>(assetPath(bookId, asset.id), {
    token: token ?? undefined,
    responseType: 'arrayBuffer',
  });
  return new Blob([data], { type: asset.mediaType });
}

export async function deleteAuthorAsset(
  bookId: string,
  assetId: string,
  token?: string | null,
): Promise<void> {
  await apiRequest<{ deleted: boolean }>(assetPath(bookId, assetId), {
    method: 'DELETE',
    token: token ?? undefined,
  });
}
