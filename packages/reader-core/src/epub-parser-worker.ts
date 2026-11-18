import { createTraceId } from '@do-epub-studio/shared';

export interface EpubParseResult {
  valid: boolean;
  error?: string;
  data?: ArrayBuffer;
}

interface WorkerPoolMessage {
  type: 'parse';
  id: string;
  source: string | Uint8Array;
}

interface WorkerResultMessage {
  type: 'result';
  id: string;
  result: EpubParseResult;
}

type MainToWorkerMessage = WorkerPoolMessage;
type WorkerToMainMessage = WorkerResultMessage | { type: 'ready' };
interface PendingWorkerParse {
  resolve: (result: EpubParseResult) => void;
  reject: (error: Error) => void;
  source: string | Uint8Array;
  sent: boolean;
}

const PARSE_TIMEOUT_MS = 30_000;
const WORKER_READY_TIMEOUT_MS = 5_000;

class EpubParserWorkerPool {
  private worker: Worker | null = null;
  private pending = new Map<string, PendingWorkerParse>();
  private idCounter = 0;
  private terminated = false;
  /** True once the worker posts its 'ready' handshake — proof the script loaded. */
  private workerReady = false;
  private workerReadyTimeout: ReturnType<typeof setTimeout> | null = null;

  private getWorker(): Worker | null {
    if (this.worker) return this.worker;
    if (this.terminated) return null;
    if (typeof Worker === 'undefined') return null;

    try {
      const workerUrl = new URL('./epub-parser.worker.ts', import.meta.url);
      const worker = new Worker(workerUrl, { type: 'module' });
      this.worker = worker;
      this.workerReady = false;

      worker.onmessage = (event: MessageEvent<WorkerToMainMessage>) => {
        if (this.worker !== worker) return;
        const data = event.data;
        if (data.type === 'ready') {
          this.workerReady = true;
          this.clearWorkerReadyTimeout();
          for (const [id, pending] of this.pending) {
            this.postPending(worker, id, pending);
          }
          return;
        }
        const pending = this.pending.get(data.id);
        if (pending) {
          pending.resolve(data.result);
          this.pending.delete(data.id);
        }
      };

      worker.onerror = (event) => {
        const msg =
          event.message ??
          (event.filename
            ? `Worker load failed: ${event.filename}:${event.lineno}`
            : 'Worker initialization failed');
        this.handleWorkerFailure(worker, new Error(msg));
      };

      this.workerReadyTimeout = setTimeout(() => {
        this.handleWorkerFailure(worker, new Error('Worker initialization timed out'));
      }, WORKER_READY_TIMEOUT_MS);
    } catch {
      return null;
    }

    return this.worker;
  }

  private postPending(worker: Worker, id: string, pending: PendingWorkerParse): void {
    if (pending.sent || this.worker !== worker) return;
    const message: MainToWorkerMessage = {
      type: 'parse',
      id,
      source: pending.source,
    };
    try {
      if (pending.source instanceof Uint8Array) {
        worker.postMessage(message, [pending.source.buffer as ArrayBuffer]);
      } else {
        worker.postMessage(message);
      }
      pending.sent = true;
    } catch (error) {
      this.pending.delete(id);
      pending.reject(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private clearWorkerReadyTimeout(): void {
    if (this.workerReadyTimeout !== null) {
      clearTimeout(this.workerReadyTimeout);
      this.workerReadyTimeout = null;
    }
  }

  private handleWorkerFailure(worker: Worker, error: Error): void {
    if (this.worker !== worker) return;
    this.clearWorkerReadyTimeout();
    const pendingList = [...this.pending.values()];
    this.pending.clear();

    if (!this.workerReady) {
      // If the worker never became ready, use the documented main-thread
      // fallback instead of leaving pending parses until their outer timeout.
      for (const pending of pendingList) {
        void this.fallbackParse(pending.source).then(pending.resolve, pending.reject);
      }
    } else {
      for (const pending of pendingList) {
        pending.reject(error);
      }
    }

    try {
      worker.terminate();
    } catch {
      // already terminated by the runtime
    }
    this.worker = null;
  }

  async parse(source: string | Uint8Array): Promise<EpubParseResult> {
    const worker = this.getWorker();
    if (!worker) {
      return this.fallbackParse(source);
    }

    const id = `parse_${++this.idCounter}`;

    return new Promise<EpubParseResult>((resolve, reject) => {
      const pending: PendingWorkerParse = {
        resolve: (result) => {
          clearTimeout(timer);
          resolve(result);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
        source,
        sent: false,
      };
      this.pending.set(id, pending);

      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('EPUB parse timeout'));
      }, PARSE_TIMEOUT_MS);

      if (this.workerReady) {
        this.postPending(worker, id, pending);
      }
    });
  }

  private async fallbackParse(source: string | Uint8Array): Promise<EpubParseResult> {
    try {
      let data: Uint8Array;
      if (typeof source === 'string') {
        const response = await fetch(source);
        if (!response.ok) {
          throw new Error(`Failed to fetch EPUB: ${response.statusText}`);
        }
        const buffer = await response.arrayBuffer();
        data = new Uint8Array(buffer);
      } else {
        data = source;
      }

      // A static import would pull fallback-only validation into the reader route.
      const { validateArchive } = await import('./archive-validator');
      await validateArchive(data, { timeoutMs: 10_000, traceId: createTraceId() });

      return { valid: true, data: data.buffer as ArrayBuffer };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  terminate(): void {
    this.terminated = true;
    this.clearWorkerReadyTimeout();
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    const error = new Error('Worker terminated');
    for (const [, pending] of this.pending) {
      pending.reject(error);
    }
    this.pending.clear();
  }
}

let globalPool: EpubParserWorkerPool | null = null;

function getPool(): EpubParserWorkerPool {
  if (!globalPool) {
    globalPool = new EpubParserWorkerPool();
  }
  return globalPool;
}

export async function parseEpubInWorker(source: string | Uint8Array): Promise<EpubParseResult> {
  return getPool().parse(source);
}

export function terminateParserWorker(): void {
  if (globalPool) {
    globalPool.terminate();
    globalPool = null;
  }
}
