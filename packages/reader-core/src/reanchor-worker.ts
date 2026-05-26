import type { TocItem } from './epub-types';
import type { ReanchorResult, AnnotationAnchor } from './reanchor';
import { reanchorByText as directReanchorByText } from './reanchor';

interface WorkerPoolMessage {
  type: 'reanchor';
  id: string;
  targetText: string;
  toc: TocItem[];
  chapterContents: Record<string, string>;
  fuzzyThreshold?: number;
  preferChapter?: string;
}

interface WorkerResultMessage {
  type: 'result';
  id: string;
  result: ReanchorResult;
}

type MainToWorkerMessage = WorkerPoolMessage;
type WorkerToMainMessage = WorkerResultMessage;

class ReanchorWorkerPool {
  private worker: Worker | null = null;
  private pending = new Map<
    string,
    { resolve: (r: ReanchorResult) => void; reject: (e: Error) => void }
  >();
  private idCounter = 0;
  private terminated = false;

  private getWorker(): Worker | null {
    if (this.worker) return this.worker;
    if (this.terminated) return null;
    if (typeof Worker === 'undefined') return null;

    try {
      const workerUrl = new URL('./reanchor.worker.ts', import.meta.url);
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

  async reanchorByText(
    targetText: string,
    toc: TocItem[],
    loadChapterContent: (href: string) => Promise<string>,
    options: { fuzzyThreshold?: number; preferChapter?: string } = {},
  ): Promise<ReanchorResult> {
    const worker = this.getWorker();
    if (!worker) {
      return directReanchorByText(targetText, toc, loadChapterContent, options);
    }

    const id = `reanchor_${++this.idCounter}`;

    const flattenedHrefs = collectHrefs(toc);
    const uniqueBases = [...new Set(flattenedHrefs.map((h) => h.split('#')[0]).filter((b): b is string => !!b))];
    const chapterContents: Record<string, string> = {};
    for (const base of uniqueBases) {
      try {
        chapterContents[base] = await loadChapterContent(base);
      } catch {
        // Skip if loading fails
      }
    }

    return new Promise<ReanchorResult>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });

      const msg: MainToWorkerMessage = {
        type: 'reanchor',
        id,
        targetText,
        toc,
        chapterContents,
        fuzzyThreshold: options.fuzzyThreshold,
        preferChapter: options.preferChapter,
      };
      worker.postMessage(msg);
    });
  }

  async tryReanchor(
    anchor: AnnotationAnchor,
    toc: TocItem[],
    loadChapterContent: (href: string) => Promise<string>,
  ): Promise<{ anchor: AnnotationAnchor; reanchorResult: ReanchorResult }> {
    if (anchor.selectedText.length < 10) {
      return {
        anchor,
        reanchorResult: {
          success: false,
          fallback: true,
          message: 'Text too short for reanchoring',
        },
      };
    }

    const result = await this.reanchorByText(anchor.selectedText, toc, loadChapterContent, {
      preferChapter: anchor.chapterRef,
    });

    if (result.success && result.chapterHref) {
      return {
        anchor: { ...anchor, chapterRef: result.chapterHref },
        reanchorResult: result,
      };
    }

    return { anchor, reanchorResult: result };
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

let globalPool: ReanchorWorkerPool | null = null;

function getPool(): ReanchorWorkerPool {
  if (!globalPool) {
    globalPool = new ReanchorWorkerPool();
  }
  return globalPool;
}

function collectHrefs(items: TocItem[]): string[] {
  const result: string[] = [];
  for (const item of items) {
    result.push(item.href);
    if (item.subitems) result.push(...collectHrefs(item.subitems));
  }
  return result;
}

export async function reanchorByText(
  targetText: string,
  toc: TocItem[],
  loadChapterContent: (href: string) => Promise<string>,
  options: { fuzzyThreshold?: number; preferChapter?: string } = {},
): Promise<ReanchorResult> {
  return getPool().reanchorByText(targetText, toc, loadChapterContent, options);
}

export async function tryReanchor(
  anchor: AnnotationAnchor,
  toc: TocItem[],
  loadChapterContent: (href: string) => Promise<string>,
): Promise<{ anchor: AnnotationAnchor; reanchorResult: ReanchorResult }> {
  return getPool().tryReanchor(anchor, toc, loadChapterContent);
}

export function terminateWorker(): void {
  if (globalPool) {
    globalPool.terminate();
    globalPool = null;
  }
}
