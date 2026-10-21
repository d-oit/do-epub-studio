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
    // `clearAllMocks` resets call history but NOT implementations, so a test
    // that installs a rejecting mock would otherwise leak into the next one.
    vi.mocked(apiRequest).mockResolvedValue({
      revision: 1,
      updatedAt: '2025-01-01T00:00:00Z',
    });
    vi.mocked(getProgress).mockResolvedValue(undefined);
    vi.mocked(saveProgress).mockResolvedValue(undefined);
    vi.mocked(queueSync).mockResolvedValue(undefined);
    vi.mocked(generateMutationId).mockReturnValue('test-mutation-id');
    vi.useFakeTimers();
    setOnline(true);
    useReaderStore.setState({
      progress: { locator: null, progressPercent: 0, updatedAt: null, revision: 0 },
      progressRestored: true,
    });
    // The handler under test owns the session `token-123` (see makeHandler),
    // so the store must hold that same session: a progress write may only
    // happen while the session that opened the book is still current.
    useAuthStore.setState({ sessionToken: 'token-123', bookId: 'book-1' });
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

  it('writes nothing once the owning session ended, and never rejects', async () => {
    const { handler } = makeHandler();

    await handler.onRelocated({ start: { cfi: 'epubcfi(/6/4)', href: 'ch1.xhtml' } });

    // The session ends before the debounced save fires — the reader was
    // closed or the session expired. The local store is purged by the
    // teardown, so the pending write must be dropped, not attempted: the
    // commit-boundary fence would refuse it, and the refusal surfaced as an
    // unhandled promise rejection because `flush()` discards its promise.
    useAuthStore.setState({ sessionToken: null, bookId: null });

    await expect(handler.flush()).resolves.toBeUndefined();
    expect(apiRequest).not.toHaveBeenCalled();
    expect(saveProgress).not.toHaveBeenCalled();
    expect(queueSync).not.toHaveBeenCalled();
  });

  it('writes nothing once the owning session was replaced by another one', async () => {
    const { handler } = makeHandler();

    await handler.onRelocated({ start: { cfi: 'epubcfi(/6/4)', href: 'ch1.xhtml' } });

    // A different session is now current. The pending write belongs to the
    // previous one, and saving it would encrypt the previous session's
    // progress under the new session's key.
    useAuthStore.setState({ sessionToken: 'token-456', bookId: 'book-1' });

    await expect(handler.flush()).resolves.toBeUndefined();
    expect(apiRequest).not.toHaveBeenCalled();
    expect(saveProgress).not.toHaveBeenCalled();
    expect(queueSync).not.toHaveBeenCalled();
  });

  it('does not write the old session progress when the session is replaced while the request is in flight', async () => {
    // The online PUT is deferred, so the session can be replaced *after* the
    // write started but *before* it falls back to the offline queue. That
    // fallback is the dangerous path: `saveProgress` captures the current
    // token as its encryption key, so writing there after a session change
    // would encrypt the previous session's progress under the new session's
    // key — two sessions in one store.
    // Built with the Promise constructor rather than `Promise.withResolvers`
    // because apps/web compiles against the ES2022 lib (lib es2024 is not
    // enabled) — the same constraint `lib/api/core.test.ts` documents.
    let rejectRequest: (reason: Error) => void = () => {};
    const requestResult = new Promise<{ revision: number; updatedAt: string }>(
      (_resolve, reject) => {
        rejectRequest = reject;
      },
    );
    vi.mocked(apiRequest).mockReturnValue(requestResult);

    const { handler } = makeHandler();
    await handler.onRelocated({ start: { cfi: 'epubcfi(/6/4)', href: 'ch1.xhtml' } });

    // Fire the save without awaiting it: the PUT is still pending.
    const flushed = handler.flush();
    await vi.advanceTimersByTimeAsync(0);
    expect(apiRequest).toHaveBeenCalledTimes(1);

    // The session is replaced while the request is pending.
    useAuthStore.setState({ sessionToken: 'token-456', bookId: 'book-1' });

    // The request now fails (the old session was aborted), which sends the
    // write down the offline-queue fallback.
    rejectRequest(new Error('Session expired'));
    await flushed;

    // The fallback must not have written anything for the replaced session.
    expect(saveProgress).not.toHaveBeenCalled();
    expect(queueSync).not.toHaveBeenCalled();
  });

  it('does not enqueue the old session progress when the session is replaced while the save is in flight', async () => {
    // The offline write is deferred, so the session can be replaced after
    // `saveProgress` started but before it settled. The write itself is
    // fenced by the commit-boundary fence, but `queueSync` captures the
    // *current* token for its own fence — so without a second ownership
    // check, the old session's progress would be enqueued under the
    // replacement session.
    //
    // Built with the Promise constructor rather than `Promise.withResolvers`
    // because apps/web compiles against the ES2022 lib (lib es2024 is not
    // enabled).
    let resolveSave: () => void = () => {};
    const pendingSave = new Promise<void>((resolve) => {
      resolveSave = resolve;
    });
    vi.mocked(saveProgress).mockReturnValue(pendingSave);

    setOnline(false);
    const { handler } = makeHandler();

    // The offline path persists immediately, so the save is already in
    // flight when the session changes.
    const relocated = handler.onRelocated({ start: { cfi: 'epubcfi(/6/4)', href: 'ch1.xhtml' } });
    await vi.advanceTimersByTimeAsync(0);
    expect(saveProgress).toHaveBeenCalledTimes(1);

    // The session is replaced while the save is pending.
    useAuthStore.setState({ sessionToken: 'token-456', bookId: 'book-1' });
    resolveSave();
    await relocated;

    // The enqueue must not have happened for the replaced session.
    expect(queueSync).not.toHaveBeenCalled();
  });

  it('does not reject when the session is replaced and the write is refused mid-write', async () => {
    // The real `saveProgress` does not merely complete late when the session
    // changes — the commit-boundary fence rejects it with a 401 ("Session
    // expired"). That rejection used to escape `queueOffline` → `flush()`,
    // and because `flush()` discards its promise it surfaced as a
    // `window.unhandledrejection` in the page.
    //
    // Built with the Promise constructor rather than `Promise.withResolvers`
    // because apps/web compiles against the ES2022 lib (lib es2024 is not
    // enabled).
    let rejectSave: (reason: Error) => void = () => {};
    const pendingSave = new Promise<void>((_resolve, reject) => {
      rejectSave = reject;
    });
    vi.mocked(saveProgress).mockReturnValue(pendingSave);

    setOnline(false);
    const { handler } = makeHandler();

    const relocated = handler.onRelocated({ start: { cfi: 'epubcfi(/6/4)', href: 'ch1.xhtml' } });
    await vi.advanceTimersByTimeAsync(0);
    expect(saveProgress).toHaveBeenCalledTimes(1);

    // The session is replaced while the write is pending, so the fence
    // refuses the write with the 401 ownership-loss refusal.
    useAuthStore.setState({ sessionToken: 'token-456', bookId: 'book-1' });
    const refusal = new Error('Session expired');
    (refusal as Error & { status?: number }).status = 401;
    rejectSave(refusal);

    // The refusal is expected and must not escape as a rejection.
    await expect(relocated).resolves.toBeUndefined();
    expect(queueSync).not.toHaveBeenCalled();
  });

  it('still propagates a genuine storage failure', async () => {
    // The ownership-loss refusal is the only failure that is swallowed. A
    // real storage error (quota, broken IndexedDB) must keep propagating:
    // hiding it would turn a broken offline store into silent data loss.
    const storageFailure = new Error('QuotaExceededError');
    vi.mocked(saveProgress).mockRejectedValue(storageFailure);

    setOnline(false);
    const { handler } = makeHandler();

    await expect(
      handler.onRelocated({ start: { cfi: 'epubcfi(/6/4)', href: 'ch1.xhtml' } }),
    ).rejects.toThrow('QuotaExceededError');
    expect(queueSync).not.toHaveBeenCalled();
  });

  it('does not reject when the enqueue is refused because the session ended', async () => {
    // The enqueue is fenced the same way the write is: `addToSyncQueue`
    // re-checks the owning session after its own awaits, so it can refuse
    // with the same 401 while the enqueue is in flight.
    //
    // Built with the Promise constructor rather than `Promise.withResolvers`
    // because apps/web compiles against the ES2022 lib (lib es2024 is not
    // enabled).
    let rejectEnqueue: (reason: Error) => void = () => {};
    const pendingEnqueue = new Promise<void>((_resolve, reject) => {
      rejectEnqueue = reject;
    });
    vi.mocked(queueSync).mockReturnValue(pendingEnqueue);

    setOnline(false);
    const { handler } = makeHandler();

    const relocated = handler.onRelocated({ start: { cfi: 'epubcfi(/6/4)', href: 'ch1.xhtml' } });
    await vi.advanceTimersByTimeAsync(0);
    expect(queueSync).toHaveBeenCalledTimes(1);

    // The session ends while the enqueue is pending.
    useAuthStore.setState({ sessionToken: null, bookId: null });
    const refusal = new Error('Session expired');
    (refusal as Error & { status?: number }).status = 401;
    rejectEnqueue(refusal);

    // The refusal is expected and must not escape as a rejection.
    await expect(relocated).resolves.toBeUndefined();
  });

  it('still propagates a genuine enqueue failure', async () => {
    const enqueueFailure = new Error('IndexedDB write failed');
    vi.mocked(queueSync).mockRejectedValue(enqueueFailure);

    setOnline(false);
    const { handler } = makeHandler();

    await expect(
      handler.onRelocated({ start: { cfi: 'epubcfi(/6/4)', href: 'ch1.xhtml' } }),
    ).rejects.toThrow('IndexedDB write failed');
  });
});
