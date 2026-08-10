import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRelocatedHandler, PROGRESS_PUT_DEBOUNCE_MS } from '../useEpubProgress';

vi.mock('../../../../lib/api', () => ({
  apiRequest: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../../../lib/offline', () => ({
  saveProgress: vi.fn().mockResolvedValue(undefined),
  queueSync: vi.fn().mockResolvedValue(undefined),
  generateMutationId: vi.fn().mockReturnValue('test-mutation-id'),
}));

vi.mock('../../../../lib/client-logger', () => ({
  logClientEvent: vi.fn(),
}));

import { apiRequest } from '../../../../lib/api';
import { saveProgress } from '../../../../lib/offline';

function makeHandler() {
  const setProgress = vi.fn();
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
  return { setProgress, setCurrentChapter, onChapterChange, markPageRead, currentChapterRef, handler };
}

function setOnline(value: boolean): void {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true, writable: true });
}

function lastPutCfi(): string {
  const call = vi.mocked(apiRequest).mock.calls.at(-1);
  const [, options] = call as unknown as [string, { body: string }];
  const parsed = JSON.parse(options.body) as { locator: { cfi: string }; progressPercent: number };
  return parsed.locator.cfi;
}

describe('createRelocatedHandler — progress PUT debounce (GOAP-224 B6)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    setOnline(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('coalesces rapid page flips to exactly one PUT carrying the latest position', async () => {
    const { handler } = makeHandler();

    await handler.onRelocated({ start: { cfi: 'epubcfi(/6/4)', progress: 10, href: 'ch1.xhtml' } });
    await handler.onRelocated({ start: { cfi: 'epubcfi(/6/8)', progress: 20, href: 'ch1.xhtml' } });
    await handler.onRelocated({ start: { cfi: 'epubcfi(/6/12)', progress: 30, href: 'ch1.xhtml' } });

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

    await handler.onRelocated({ start: { cfi: 'epubcfi(/6/20)', progress: 50, href: 'ch2.xhtml' } });
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

    await handler.onRelocated({ start: { cfi: 'epubcfi(/6/4)', progress: 10, href: 'ch1.xhtml' } });
    await handler.onRelocated({ start: { cfi: 'epubcfi(/6/8)', progress: 20, href: 'ch1.xhtml' } });

    expect(saveProgress).toHaveBeenCalledTimes(2);
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it('keeps the pending debounce window from firing after flush() grabbed it', async () => {
    const { handler } = makeHandler();

    await handler.onRelocated({ start: { cfi: 'epubcfi(/6/4)', progress: 10, href: 'ch1.xhtml' } });
    await handler.flush();

    // The original timer was cleared by flush — advancing the window must not
    // trigger a duplicate PUT.
    await vi.advanceTimersByTimeAsync(PROGRESS_PUT_DEBOUNCE_MS);
    expect(apiRequest).toHaveBeenCalledTimes(1);
  });
});
