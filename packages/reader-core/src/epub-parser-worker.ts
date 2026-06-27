import { validateArchive } from './archive-validator';

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
type WorkerToMainMessage = WorkerResultMessage;

const PARSE_TIMEOUT_MS = 30_000;

class EpubParserWorkerPool {
  private worker: Worker | null = null;
  private pending = new Map<
    string,
    { resolve: (r: EpubParseResult) => void; reject: (e: Error) => void }
  >();
  private idCounter = 0;
  private terminated = false;

  private getWorker(): Worker | null {
    if (this.worker) return this.worker;
    if (this.terminated) return null;
    if (typeof Worker === 'undefined') return null;

    try {
      const workerUrl = new URL('./epub-parser.worker.ts', import.meta.url);
      this.worker = new Worker(workerUrl, { type: 'module' });

      this.worker.onmessage = (event: MessageEvent<WorkerToMainMessage>) => {
        const data = event.data;
        if (data.type === 'result') {
          const pending = this.pending.get(data.id);
          if (pending) {
            pending.resolve(data.result);
            this.pending.delete(data.id);
          }
        }
      };

      this.worker.onerror = (event) => {
        const id = this.pending.keys().next().value;
        if (id) {
          const pending = this.pending.get(id);
          if (pending) {
            pending.reject(new Error(`Worker error: ${event.message}`));
            this.pending.delete(id);
          }
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

      await validateArchive(data);

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
