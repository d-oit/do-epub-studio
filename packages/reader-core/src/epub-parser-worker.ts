import { validateArchive } from './archive-validator';
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

const PARSE_TIMEOUT_MS = 30_000;

class EpubParserWorkerPool {
  private worker: Worker | null = null;
  private pending = new Map<
    string,
    {
      resolve: (r: EpubParseResult) => void;
      reject: (e: Error) => void;
      source: string | Uint8Array;
    }
  >();
  private idCounter = 0;
  private terminated = false;
  /** True once the worker posts its 'ready' handshake — proof the script loaded. */
  private workerReady = false;

  private getWorker(): Worker | null {
    if (this.worker) return this.worker;
    if (this.terminated) return null;
    if (typeof Worker === 'undefined') return null;

    try {
      const workerUrl = new URL('./epub-parser.worker.ts', import.meta.url);
      this.worker = new Worker(workerUrl, { type: 'module' });
      this.workerReady = false;

      this.worker.onmessage = (event: MessageEvent<WorkerToMainMessage>) => {
        const data = event.data;
        if (data.type === 'ready') {
          this.workerReady = true;
          return;
        }
        if (data.type === 'result') {
          const pending = this.pending.get(data.id);
          if (pending) {
            pending.resolve(data.result);
            this.pending.delete(data.id);
          }
        }
      };

      this.worker.onerror = (event) => {
        const msg =
          event.message ??
          (event.filename
            ? `Worker load failed: ${event.filename}:${event.lineno}`
            : 'Worker initialization failed');
        const error = new Error(msg);
        const pendingList = [...this.pending.values()];
        this.pending.clear();

        if (!this.workerReady) {
          // LOAD failure: the worker script never started (e.g. production
          // builds where the worker chunk is mis-served — see issue #957).
          // Degrade to the documented main-thread fallback instead of failing
          // every book load. ADR-218 §6: the worker is the preferred path, the
          // main-thread fallback exists for exactly this "worker unavailable"
          // case.
          for (const pending of pendingList) {
            void this.fallbackParse(pending.source).then(pending.resolve, pending.reject);
          }
        } else {
          // GOAP-224 A8: runtime crash after a successful load — reject ALL
          // in-flight parses, not just the first. The previously-resolved
          // handler only rejected `pending.keys().next().value` and left every
          // other parse hanging until the 30s timeout while the crashed worker
          // stayed in the pool for reuse.
          for (const pending of pendingList) {
            pending.reject(error);
          }
        }

        // The worker is in an unknown state after an error event — terminate it
        // and clear the slot so the next parse() spawns a fresh worker. Do NOT
        // set `terminated` (that would permanently demote the pool to the
        // main-thread fallback path instead of transparently recovering).
        if (this.worker) {
          try {
            this.worker.terminate();
          } catch {
            // already terminated by the runtime
          }
          this.worker = null;
        }
      };
    } catch {
      return null;
    }

    return this.worker;
  }

  async parse(source: string | Uint8Array): Promise<EpubParseResult> {
    const worker = this.getWorker();
    if (!worker) {
      return this.fallbackParse(source);
    }

    const id = `parse_${++this.idCounter}`;

    const transferables: Transferable[] = [];
    if (source instanceof Uint8Array) {
      transferables.push(source.buffer as ArrayBuffer);
    }

    return new Promise<EpubParseResult>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (result) => {
          clearTimeout(timer);
          resolve(result);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
        source,
      });

      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('EPUB parse timeout'));
      }, PARSE_TIMEOUT_MS);

      const msg: MainToWorkerMessage = {
        type: 'parse',
        id,
        source,
      };
      worker.postMessage(msg, transferables);
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

export async function parseEpubInWorker(
  source: string | Uint8Array,
): Promise<EpubParseResult> {
  return getPool().parse(source);
}

export function terminateParserWorker(): void {
  if (globalPool) {
    globalPool.terminate();
    globalPool = null;
  }
}
