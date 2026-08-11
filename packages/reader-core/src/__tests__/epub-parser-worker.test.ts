import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { parseEpubInWorker, terminateParserWorker } from '../epub-parser-worker';
import type { EpubParseResult } from '../epub-parser-worker';

const mockArrayBuffer = new ArrayBuffer(8);

vi.stubGlobal(
  'fetch',
  vi.fn().mockResolvedValue({
    ok: true,
    arrayBuffer: vi.fn().mockResolvedValue(mockArrayBuffer),
  }),
);

vi.mock('../archive-validator', () => ({
  validateArchive: vi.fn().mockResolvedValue(undefined),
}));

describe('parseEpubInWorker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns valid result for valid Uint8Array data', async () => {
    const data = new Uint8Array([1, 2, 3, 4]);
    const result: EpubParseResult = await parseEpubInWorker(data);
    expect(result.valid).toBe(true);
    expect(result.data).toBeInstanceOf(ArrayBuffer);
    expect(result.error).toBeUndefined();
  });

  it('returns valid result for valid URL string', async () => {
    const result: EpubParseResult = await parseEpubInWorker('https://example.com/book.epub');
    expect(result.valid).toBe(true);
    expect(result.data).toBeInstanceOf(ArrayBuffer);
    expect(result.error).toBeUndefined();
    expect(fetch).toHaveBeenCalledWith('https://example.com/book.epub');
  });

  it('returns error for fetch failure', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));
    const result: EpubParseResult = await parseEpubInWorker('https://example.com/book.epub');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Network error');
    expect(result.data).toBeUndefined();
  });

  it('returns error for non-ok fetch response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      statusText: 'Not Found',
    } as Response);
    const result: EpubParseResult = await parseEpubInWorker('https://example.com/book.epub');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Not Found');
    expect(result.data).toBeUndefined();
  });

  it('returns error when archive validation fails', async () => {
    const { validateArchive } = await import('../archive-validator');
    vi.mocked(validateArchive).mockRejectedValueOnce(new Error('Invalid archive'));
    const data = new Uint8Array([1, 2, 3]);
    const result: EpubParseResult = await parseEpubInWorker(data);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid archive');
    expect(result.data).toBeUndefined();
  });

  it('handles Uint8Array data with no error', async () => {
    const { validateArchive } = await import('../archive-validator');
    vi.mocked(validateArchive).mockResolvedValueOnce(undefined);
    const data = new Uint8Array([10, 20, 30]);
    const result: EpubParseResult = await parseEpubInWorker(data);
    expect(result.valid).toBe(true);
    expect(result.data).toBeInstanceOf(ArrayBuffer);
  });

  it('returns error for non-Error exceptions', async () => {
    vi.mocked(fetch).mockRejectedValueOnce('string error');
    const result: EpubParseResult = await parseEpubInWorker('https://example.com/book.epub');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('string error');
  });
});

describe('terminateParserWorker', () => {
  it('can be called safely', () => {
    expect(() => terminateParserWorker()).not.toThrow();
  });

  it('can be called multiple times', () => {
    terminateParserWorker();
    terminateParserWorker();
    expect(() => terminateParserWorker()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// GOAP-224 A8/A6 — worker error recovery. jsdom has no global Worker, so the
// pool falls back to the main-thread path and the onerror handler is never
// exercised by the tests above. Stub a controllable Worker to drive it.
// ---------------------------------------------------------------------------
class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: { data: WorkerToMainMessage }) => void) | null = null;
  onerror: ((event: { message?: string; filename?: string; lineno?: number }) => void) | null = null;
  terminated = false;
  posted: unknown[] = [];

  constructor() {
    FakeWorker.instances.push(this);
  }

  postMessage(message: unknown): void {
    this.posted.push(message);
  }

  terminate(): void {
    this.terminated = true;
  }
}

interface WorkerToMainMessage {
  type: 'result' | 'ready';
  id: string;
  result: unknown;
}

describe('worker error recovery (GOAP-224 A8/A6)', () => {
  beforeEach(() => {
    vi.stubGlobal('Worker', FakeWorker);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    FakeWorker.instances = [];
    terminateParserWorker();
  });

  function getWorker(): FakeWorker {
    const worker = FakeWorker.instances[0];
    if (!worker) throw new Error('expected a spawned worker instance');
    return worker;
  }

  it('rejects ALL pending parses on worker error, terminates the worker, and spawns a fresh one (A8)', async () => {
    const p1 = parseEpubInWorker(new Uint8Array([1, 2, 3]));
    const p2 = parseEpubInWorker(new Uint8Array([4, 5, 6]));
    await Promise.resolve();

    const worker = getWorker();
    expect(worker.posted).toHaveLength(2);

    // The worker loaded successfully (ready handshake) — the onerror below is
    // therefore a RUNTIME crash, which must reject in-flight parses (A8).
    worker.onmessage?.({ data: { type: 'ready' } as WorkerToMainMessage });

    const reject1 = expect(p1).rejects.toThrow('worker crashed');
    const reject2 = expect(p2).rejects.toThrow('worker crashed');
    worker.onerror?.({ message: 'worker crashed', filename: 'epub-parser.worker.ts', lineno: 7 });
    await reject1;
    await reject2;

    // Crashed worker is terminated, not left in the pool.
    expect(worker.terminated).toBe(true);

    // The pool slot is nulled so the next parse spawns a brand-new worker.
    const p3 = parseEpubInWorker(new Uint8Array([7, 8, 9]));
    await Promise.resolve();
    expect(FakeWorker.instances.length).toBe(2);

    terminateParserWorker();
    await expect(p3).rejects.toThrow('Worker terminated');
  });

  it('terminates the crashed worker even when no parse is pending (A8 edge case)', async () => {
    const p1 = parseEpubInWorker(new Uint8Array([1, 2, 3]));
    await Promise.resolve();
    const worker = getWorker();

    worker.onmessage?.({ data: { type: 'ready' } as WorkerToMainMessage });
    const reject1 = expect(p1).rejects.toThrow('boom');
    worker.onerror?.({ message: 'boom' });
    await reject1;

    expect(worker.terminated).toBe(true);

    // A second error event (pool now empty) must not throw.
    expect(() => worker.onerror?.({ message: 'again' })).not.toThrow();
  });

  it('terminateParserWorker rejects pending parses and resets the pool so the next parse uses a fresh worker (A6)', async () => {
    const p1 = parseEpubInWorker(new Uint8Array([1, 2, 3]));
    await Promise.resolve();
    const worker = getWorker();

    const rejection = expect(p1).rejects.toThrow('Worker terminated');
    terminateParserWorker();
    await rejection;
    expect(worker.terminated).toBe(true);

    const p2 = parseEpubInWorker(new Uint8Array([4, 5, 6]));
    await Promise.resolve();
    expect(FakeWorker.instances.length).toBe(2);

    terminateParserWorker();
    await expect(p2).rejects.toThrow('Worker terminated');
  });
});

describe('worker LOAD failure (GOAP-226 — issue #957)', () => {
  beforeEach(() => {
    vi.stubGlobal('Worker', FakeWorker);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    FakeWorker.instances = [];
    terminateParserWorker();
  });

  function getWorker(): FakeWorker {
    const worker = FakeWorker.instances[0];
    if (!worker) throw new Error('expected a spawned worker instance');
    return worker;
  }

  it('degrades to the main-thread fallback when the worker never loads (no ready handshake)', async () => {
    const p1 = parseEpubInWorker(new Uint8Array([1, 2, 3]));
    const p2 = parseEpubInWorker(new Uint8Array([4, 5, 6]));
    await Promise.resolve();

    const worker = getWorker();
    // NO 'ready' message — the worker script never started (production builds
    // where the worker chunk is mis-served). onerror must NOT reject; every
    // pending parse resolves through fallbackParse (fetch + validateArchive,
    // both mocked above).
    const result1 = expect(p1).resolves.toMatchObject({ valid: true });
    const result2 = expect(p2).resolves.toMatchObject({ valid: true });
    worker.onerror?.({ message: 'Worker initialization failed' });
    await result1;
    await result2;

    // The failed worker is terminated and the slot cleared for a fresh one.
    expect(worker.terminated).toBe(true);
  });

  it('does not reject pending parses on a load failure that arrives after one result', async () => {
    const p1 = parseEpubInWorker(new Uint8Array([1, 2, 3]));
    await Promise.resolve();
    const worker = getWorker();

    // Worker started and answered one parse...
    const settled = expect(p1).resolves.toMatchObject({ valid: true });
    worker.onmessage?.({ data: { type: 'result', id: (worker.posted[0] as { id: string }).id, result: { valid: true, data: new ArrayBuffer(4) } } as unknown as WorkerToMainMessage });
    await settled;

    // ...but then a second parse finds the worker had never sent 'ready' (the
    // ready message was lost) and errors — still degrade, never reject.
    const p2 = parseEpubInWorker(new Uint8Array([7, 8, 9]));
    await Promise.resolve();
    const settled2 = expect(p2).resolves.toMatchObject({ valid: true });
    worker.onerror?.({ message: 'Worker initialization failed' });
    await settled2;
  });
});
