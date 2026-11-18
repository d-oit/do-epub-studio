import { StrictMode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { AuthorAssetMetadata } from '@do-epub-studio/shared';
import { useAuthorAssetUrls } from './useAuthorAssetUrls';

const mocks = vi.hoisted(() => ({
  fetchAuthorAsset: vi.fn(),
}));

vi.mock('../../lib/api/author-assets', () => ({
  fetchAuthorAsset: mocks.fetchAuthorAsset,
}));

const IMAGE_ID = '11111111-1111-4111-8111-111111111111';
const IMAGE_ID_2 = '22222222-2222-4222-8222-222222222222';
const IMAGE_ID_3 = '33333333-3333-4333-8333-333333333333';

function asset(id: string, sha256 = 'a'.repeat(64)): AuthorAssetMetadata {
  return {
    id,
    name: `${id}.png`,
    mediaType: 'image/png',
    sizeBytes: 10,
    sha256,
    createdAt: '2026-11-05T12:00:00.000Z',
  };
}

const ASSETS = [asset(IMAGE_ID), asset(IMAGE_ID_2), asset(IMAGE_ID_3)];

let objectUrlCounter = 0;
let createObjectUrl: ReturnType<typeof vi.fn>;
let revokeObjectUrl: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  objectUrlCounter = 0;
  createObjectUrl = vi
    .spyOn(URL, 'createObjectURL')
    .mockImplementation(() => `blob:mock-image-${(objectUrlCounter += 1)}`);
  revokeObjectUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  mocks.fetchAuthorAsset.mockImplementation(
    (_bookId: string, authorAsset: Pick<AuthorAssetMetadata, 'id' | 'mediaType'>) =>
      new Blob([authorAsset.id], { type: authorAsset.mediaType }),
  );
});

describe('useAuthorAssetUrls', () => {
  it('fetches only the referenced ids and maps them to object URLs', async () => {
    const { result } = renderHook(() =>
      useAuthorAssetUrls('book-1', [IMAGE_ID, IMAGE_ID_3], ASSETS, 'token-1'),
    );

    await waitFor(() => expect(result.current.size).toBe(2));
    expect(mocks.fetchAuthorAsset).toHaveBeenCalledTimes(2);
    expect(mocks.fetchAuthorAsset.mock.calls.map(([bookId, , token]) => [bookId, token])).toEqual([
      ['book-1', 'token-1'],
      ['book-1', 'token-1'],
    ]);
    expect(result.current.get(IMAGE_ID)).toBe('blob:mock-image-1');
    expect(result.current.get(IMAGE_ID_3)).toBe('blob:mock-image-2');
  });

  it('keeps URLs stable when the requested id set is unchanged', async () => {
    const props = {
      bookId: 'book-1',
      assetIds: [IMAGE_ID, IMAGE_ID_2],
      assets: ASSETS,
      token: 'token-1',
    };
    const { result, rerender } = renderHook(() =>
      useAuthorAssetUrls(props.bookId, props.assetIds, props.assets, props.token),
    );

    await waitFor(() => expect(result.current.size).toBe(2));
    const firstUrl = result.current.get(IMAGE_ID);

    rerender();
    await waitFor(() => expect(mocks.fetchAuthorAsset).toHaveBeenCalledTimes(2));
    expect(result.current.get(IMAGE_ID)).toBe(firstUrl);
    expect(revokeObjectUrl).not.toHaveBeenCalled();
  });

  it('fetches newly referenced ids without refetching stable ones', async () => {
    const props = { bookId: 'book-1', assetIds: [IMAGE_ID], assets: ASSETS, token: 'token-1' };
    const { result, rerender } = renderHook(
      () => useAuthorAssetUrls(props.bookId, props.assetIds, props.assets, props.token),
      { wrapper: StrictMode },
    );

    await waitFor(() => expect(result.current.size).toBe(1));
    props.assetIds = [IMAGE_ID, IMAGE_ID_2];
    rerender();

    await waitFor(() => expect(result.current.size).toBe(2));
    expect(mocks.fetchAuthorAsset).toHaveBeenCalledTimes(3);
    expect(mocks.fetchAuthorAsset.mock.calls[2]?.[2]).toBe('token-1');
  });

  it('revokes URLs for ids that are no longer referenced', async () => {
    const props = {
      bookId: 'book-1',
      assetIds: [IMAGE_ID, IMAGE_ID_2],
      assets: ASSETS,
      token: 'token-1',
    };
    const { result, rerender } = renderHook(() =>
      useAuthorAssetUrls(props.bookId, props.assetIds, props.assets, props.token),
    );

    await waitFor(() => expect(result.current.size).toBe(2));
    const revokedUrl = result.current.get(IMAGE_ID_2);

    props.assetIds = [IMAGE_ID];
    rerender();

    await waitFor(() => expect(result.current.size).toBe(1));
    expect(revokeObjectUrl).toHaveBeenCalledWith(revokedUrl);
    expect(result.current.has(IMAGE_ID_2)).toBe(false);
  });

  it('revokes and refetches when the book or session changes', async () => {
    const props = { bookId: 'book-1', assetIds: [IMAGE_ID], assets: ASSETS, token: 'token-1' };
    const { result, rerender } = renderHook(() =>
      useAuthorAssetUrls(props.bookId, props.assetIds, props.assets, props.token),
    );

    await waitFor(() => expect(result.current.size).toBe(1));
    const oldUrl = result.current.get(IMAGE_ID);

    props.bookId = 'book-2';
    rerender();
    await waitFor(() => expect(mocks.fetchAuthorAsset.mock.calls.at(-1)?.[0]).toBe('book-2'));
    expect(revokeObjectUrl).toHaveBeenCalledWith(oldUrl);
    expect(mocks.fetchAuthorAsset.mock.calls.at(-1)?.[2]).toBe('token-1');

    props.bookId = 'book-2';
    props.token = 'token-2';
    rerender();
    await waitFor(() => expect(mocks.fetchAuthorAsset.mock.calls.at(-1)?.[2]).toBe('token-2'));
    expect(revokeObjectUrl).toHaveBeenCalledTimes(2);
  });

  it('revokes and refetches when the asset identity changes', async () => {
    const props = {
      bookId: 'book-1',
      assetIds: [IMAGE_ID],
      assets: [asset(IMAGE_ID)],
      token: 'token-1',
    };
    const { result, rerender } = renderHook(() =>
      useAuthorAssetUrls(props.bookId, props.assetIds, props.assets, props.token),
    );

    await waitFor(() => expect(result.current.size).toBe(1));
    const oldUrl = result.current.get(IMAGE_ID);

    props.assets = [asset(IMAGE_ID, 'b'.repeat(64))];
    rerender();
    await waitFor(() => expect(mocks.fetchAuthorAsset).toHaveBeenCalledTimes(2));
    expect(revokeObjectUrl).toHaveBeenCalledWith(oldUrl);
  });

  it('aborts in-flight work and revokes late results on unmount', async () => {
    const { promise, resolve } = Promise.withResolvers<Blob>();
    mocks.fetchAuthorAsset.mockImplementation(() => promise);
    const { unmount } = renderHook(() =>
      useAuthorAssetUrls('book-1', [IMAGE_ID], ASSETS, 'token-1'),
    );

    await waitFor(() => expect(mocks.fetchAuthorAsset).toHaveBeenCalledTimes(1));
    unmount();

    // eslint-disable-next-line @typescript-eslint/require-await -- the intentionally empty async body is the flush under test: resolving after unmount must revoke the orphaned blob URL
    await act(async () => {
      resolve(new Blob([IMAGE_ID], { type: 'image/png' }));
    });

    expect(createObjectUrl).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrl).toHaveBeenCalledWith(createObjectUrl.mock.results[0]?.value);
  });

  it('resolves a missing referenced asset to no URL without throwing', async () => {
    const { result } = renderHook(() => useAuthorAssetUrls('book-1', [IMAGE_ID], [], 'token-1'));

    await waitFor(() => expect(mocks.fetchAuthorAsset).not.toHaveBeenCalled());
    expect(result.current.size).toBe(0);
  });
});
