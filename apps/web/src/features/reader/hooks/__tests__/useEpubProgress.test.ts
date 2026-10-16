import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRelocatedHandler, PROGRESS_PUT_DEBOUNCE_MS } from '../useEpubProgress';
import { useReaderStore, type ReadingProgress } from '../../../../stores/reader';

vi.mock('../../../../lib/api', () => ({
  apiRequest: vi.fn().mockResolvedValue({
    revision: 1,
    updatedAt: '2025-01-01T00:00:00Z',
  }),
}));

vi.mock('../../../../lib/offline', () => ({
  getProgress: vi.fn().mockResolvedValue(undefined),
  saveProgress: vi.fn().mockResolvedValue(undefined),
  queueSync: vi.fn().mockResolvedValue(undefined),
  generateMutationId: vi.fn().mockReturnValue('test-mutation-id'),
}));

vi.mock('../../../../lib/client-logger', () => ({
  logClientEvent: vi.fn(),
}));

import { apiRequest } from '../../../../lib/api';
import { getProgress, generateMutationId, queueSync, saveProgress } from '../../../../lib/offline';
import { useAuthStore } from '../../../../stores/auth';
function makeHandler() {
  const setProgress = vi.fn((progress: ReadingProgress) =>
    useReaderStore.getState().setProgress(progress),
  );
  const setCurrentChapter = vi.fn();
  const onChapterChange = vi.fn();
  const markPageRead = vi.fn();
  const currentChapterRef = { current: null } as { current: string | null };
  const handler = createRelocatedHandler(
    'book-1',
    'token-123',
    setProgress,
    setCurrentChapter,
    [{ href: 'ch1.xhtml' }, { href: 'ch2.xhtml' }],
    currentChapterRef,
    onChapterChange,
    markPageRead,
  );
  return {
    setProgress,
    setCurrentChapter,
    onChapterChange,
    markPageRead,
    currentChapterRef,
    handler,
  };
}

function setOnline(value: boolean): void {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true, writable: true });
}

interface ProgressPutBody {
  locator: { cfi: string };
  progressPercent: number;
  mutationId: string;
  baseRevision: number;
  dependsOnMutationId?: string;
}

function lastPutBody(): ProgressPutBody {
  const call = vi.mocked(apiRequest).mock.calls.at(-1);
  const [, options] = call as unknown as [string, { body: string }];
  return JSON.parse(options.body) as ProgressPutBody;
}

function lastPutCfi(): string {
  return lastPutBody().locator.cfi;
}

describe('createRelocatedHandler — progress PUT debounce (GOAP-224 B6)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiRequest).mockResolvedValue({
      revision: 1,
      updatedAt: '2025-01-01T00:00:00Z',
    });
    vi.mocked(getProgress).mockResolvedValue(undefined);
    vi.mocked(generateMutationId).mockReturnValue('test-mutation-id');
    vi.useFakeTimers();
    setOnline(true);
    useReaderStore.setState({
      progress: { locator: null, progressPercent: 0, updatedAt: null, revision: 0 },
      progressRestored: true,
    });
    useAuthStore.setState({ sessionToken: null, bookId: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('coalesces rapid page flips to exactly one PUT carrying the latest position', async () => {
    const { handler } = makeHandler();

    await handler.onRelocated({
      start: { cfi: 'epubcfi(/6/4)', percentage: 0.1, href: 'ch1.xhtml' },
    });
    await handler.onRelocated({
      start: { cfi: 'epubcfi(/6/8)', percentage: 0.2, href: 'ch1.xhtml' },
    });
    await handler.onRelocated({
      start: { cfi: 'epubcfi(/6/12)', percentage: 0.3, href: 'ch1.xhtml' },
    });

    // Within the window no network call is made…
    await vi.advanceTimersByTimeAsync(PROGRESS_PUT_DEBOUNCE_MS - 1);
    expect(apiRequest).not.toHaveBeenCalled();

    // …and crossing the window fires exactly one PUT with the newest position.
    await vi.advanceTimersByTimeAsync(1);
    expect(apiRequest).toHaveBeenCalledTimes(1);
    expect(lastPutCfi()).toBe('epubcfi(/6/12)');
  });

  it('flush() persists the pending position immediately (unmount/reader close)', async () => {
    const { handler } = makeHandler();

    await handler.onRelocated({
      start: { cfi: 'epubcfi(/6/20)', percentage: 0.5, href: 'ch2.xhtml' },
    });
    expect(apiRequest).not.toHaveBeenCalled();

    await handler.flush();
    expect(apiRequest).toHaveBeenCalledTimes(1);
    expect(lastPutCfi()).toBe('epubcfi(/6/20)');
    expect(saveProgress).not.toHaveBeenCalled();

    // Nothing left pending — a second flush is a no-op.
    await handler.flush();
    expect(apiRequest).toHaveBeenCalledTimes(1);
  });

  it('does NOT debounce the offline path — each relocation persists immediately', async () => {
    setOnline(false);
    const { handler } = makeHandler();

    await handler.onRelocated({
      start: { cfi: 'epubcfi(/6/4)', percentage: 0.1, href: 'ch1.xhtml' },
    });
    await handler.onRelocated({
      start: { cfi: 'epubcfi(/6/8)', percentage: 0.2, href: 'ch1.xhtml' },
    });

    expect(saveProgress).toHaveBeenCalledTimes(2);
    expect(apiRequest).not.toHaveBeenCalled();
  });
  it('chains offline progress updates through the previous pending mutation', async () => {
    setOnline(false);
    useReaderStore.setState({
      progress: { locator: null, progressPercent: 0, updatedAt: null, revision: 7 },
    });
    const firstMutationId = '00000000-0000-4000-8000-000000000001';
    const secondMutationId = '00000000-0000-4000-8000-000000000002';
    vi.mocked(generateMutationId)
      .mockReturnValueOnce(firstMutationId)
      .mockReturnValueOnce(secondMutationId);
    vi.mocked(getProgress).mockResolvedValueOnce(undefined).mockResolvedValueOnce({
      id: 'book-1-progress',
      bookId: 'book-1',
      cfi: 'epubcfi(/6/4)',
      percentage: 10,
      lastRead: Date.now(),
      synced: false,
      mutationId: firstMutationId,
      baseRevision: 7,
    });
    const { handler } = makeHandler();

    await handler.onRelocated({
      start: { cfi: 'epubcfi(/6/4)', percentage: 0.1, href: 'ch1.xhtml' },
    });
    await handler.onRelocated({
      start: { cfi: 'epubcfi(/6/8)', percentage: 0.2, href: 'ch1.xhtml' },
    });

    expect(queueSync).toHaveBeenNthCalledWith(
      1,
      'progress',
      expect.objectContaining({ baseRevision: 7 }),
      firstMutationId,
    );
    expect(queueSync).toHaveBeenNthCalledWith(
      2,
      'progress',
      expect.objectContaining({
        baseRevision: 7,
        dependsOnMutationId: firstMutationId,
      }),
      secondMutationId,
    );
  });

  it('sends the acknowledged server revision and advances the reader revision', async () => {
    useAuthStore.setState({ sessionToken: 'token-123', bookId: 'book-1' });
    useReaderStore.setState({
      progress: { locator: null, progressPercent: 0, updatedAt: null, revision: 7 },
    });
    vi.mocked(apiRequest).mockResolvedValue({
      revision: 8,
      updatedAt: '2025-01-02T00:00:00Z',
    });
    const { handler } = makeHandler();

    await handler.onRelocated({
      start: { cfi: 'epubcfi(/6/8)', percentage: 0.2, href: 'ch1.xhtml' },
    });
    await handler.flush();

    expect(lastPutBody()).toMatchObject({ baseRevision: 7 });
    expect(useReaderStore.getState().progress).toMatchObject({
      revision: 8,
      updatedAt: '2025-01-02T00:00:00Z',
    });
  });

  it('keeps the pending debounce window from firing after flush() grabbed it', async () => {
    const { handler } = makeHandler();

    await handler.onRelocated({
      start: { cfi: 'epubcfi(/6/4)', percentage: 0.1, href: 'ch1.xhtml' },
    });
    await handler.flush();

    // The original timer was cleared by flush — advancing the window must not
    // trigger a duplicate PUT.
    await vi.advanceTimersByTimeAsync(PROGRESS_PUT_DEBOUNCE_MS);
    expect(apiRequest).toHaveBeenCalledTimes(1);
  });
  it('converts the rendition 0–1 fraction to the 0–100 store/server contract', async () => {
    const { handler, setProgress } = makeHandler();

    await handler.onRelocated({
      start: { cfi: 'epubcfi(/6/4)', percentage: 0.5, href: 'ch1.xhtml' },
    });

    expect(setProgress).toHaveBeenCalledWith(expect.objectContaining({ progressPercent: 50 }));
    await handler.flush();
    expect(lastPutBody().progressPercent).toBe(50);
  });

  it('retains the current progress when the rendition omits percentage', async () => {
    useReaderStore.setState({
      progress: { locator: { cfi: 'epubcfi(/6/2)' }, progressPercent: 42, updatedAt: null },
      progressRestored: true,
    });
    const { handler, setProgress } = makeHandler();

    await handler.onRelocated({ start: { cfi: 'epubcfi(/6/4)', href: 'ch1.xhtml' } });

    expect(setProgress).toHaveBeenCalledWith(expect.objectContaining({ progressPercent: 42 }));
    await handler.flush();
    expect(lastPutBody().progressPercent).toBe(42);
  });

  it('does not persist the pre-restore first display, so offline reload keeps the stored position', async () => {
    setOnline(false);
    useReaderStore.setState({
      progress: { locator: null, progressPercent: 0, updatedAt: null, revision: 0 },
      progressRestored: false,
    });
    const { handler, setProgress, setCurrentChapter, onChapterChange, markPageRead } =
      makeHandler();

    // The reader's programmatic first display fires 'relocated' before the
    // initial progress load settles. Persisting it overwrote the stored last
    // position with the book's start (offline reload then restored 0%).
    await handler.onRelocated({
      start: { cfi: 'epubcfi(/6/2!/4/2[p1]/1:0)', href: 'ch1.xhtml' },
    });
    await handler.flush();

    expect(setProgress).not.toHaveBeenCalled();
    expect(saveProgress).not.toHaveBeenCalled();
    expect(queueSync).not.toHaveBeenCalled();
    expect(apiRequest).not.toHaveBeenCalled();
    // Chapter tracking stays independent of progress persistence.
    expect(setCurrentChapter).toHaveBeenCalledWith('ch1.xhtml');
    expect(onChapterChange).toHaveBeenCalled();
    expect(markPageRead).toHaveBeenCalled();

    // Once the loader has settled, relocations persist again.
    useReaderStore.setState({ progressRestored: true });
    await handler.onRelocated({ start: { cfi: 'epubcfi(/6/8)', href: 'ch1.xhtml' } });
    await handler.flush();
    expect(saveProgress).toHaveBeenCalledTimes(1);
  });
});
