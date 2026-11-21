import type { CacheLike, CacheStorageLike } from '../cache';

/**
 * In-memory CacheStorage/Cache implementation for unit tests (jsdom has no
 * real CacheStorage). Stores real Response objects; match() returns clones so
 * consumers can consume bodies repeatedly. `corruptOnPut` lets tests simulate
 * storage corruption (bit-rotted cache entry).
 */

function keyOf(request: Request | string): string {
  return typeof request === 'string' ? request : request.url;
}

export class InMemoryCache implements CacheLike {
  private readonly entries = new Map<string, Response>();
  private corrupt = false;

  corruptOnPut(): void {
    this.corrupt = true;
  }

  async put(request: Request | string, response: Response): Promise<void> {
    const body = this.corrupt ? new Uint8Array([0x42]) : await response.clone().arrayBuffer();
    const stored = new Response(body, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') ?? 'application/octet-stream',
        'Content-Length': String(body.byteLength),
      },
    });
    this.entries.set(keyOf(request), stored);
  }

  match(request: Request | string): Promise<Response | undefined> {
    const stored = this.entries.get(keyOf(request));
    return Promise.resolve(stored ? stored.clone() : undefined);
  }

  delete(request: Request | string): Promise<boolean> {
    return Promise.resolve(this.entries.delete(keyOf(request)));
  }

  keys(): Promise<string[]> {
    return Promise.resolve([...this.entries.keys()]);
  }

  has(url: string): boolean {
    return this.entries.has(url);
  }

  size(): number {
    return this.entries.size;
  }
}

export class InMemoryCacheStorage implements CacheStorageLike {
  private readonly caches = new Map<string, InMemoryCache>();

  open(name: string): Promise<InMemoryCache> {
    let cache = this.caches.get(name);
    if (!cache) {
      cache = new InMemoryCache();
      this.caches.set(name, cache);
    }
    return Promise.resolve(cache);
  }

  keys(): Promise<string[]> {
    return Promise.resolve([...this.caches.keys()]);
  }

  delete(name: string): Promise<boolean> {
    return Promise.resolve(this.caches.delete(name));
  }

  get(name: string): InMemoryCache | undefined {
    return this.caches.get(name);
  }
}
