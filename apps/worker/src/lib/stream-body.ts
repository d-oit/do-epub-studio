/**
 * Stream utilities for large request bodies.
 *
 * The Worker runtime exposes the request body as a `ReadableStream`. To
 * avoid loading the full body into memory, we wrap it in a counter
 * `TransformStream` that aborts with `MaxBodySizeError` once the running
 * byte total exceeds the cap, and otherwise passes bytes through
 * unchanged. The original stream is never `.arrayBuffer()`'d.
 *
 * Reference: ADR-112 (stream upload + edge cache).
 */

/** Default cap (200 MB) — matches the books upload route. */
export const DEFAULT_MAX_BODY_BYTES = 200 * 1024 * 1024;

export class MaxBodySizeError extends Error {
  override readonly name = 'MaxBodySizeError';
  constructor(public readonly maxBytes: number) {
    super(`Request body exceeds maximum size of ${maxBytes} bytes`);
  }
}

/**
 * Count bytes flowing through the transform; abort with `MaxBodySizeError`
 * when `maxBytes` is exceeded. Intended for use as the final guard
 * behind a pre-check on `Content-Length`.
 */
export class ByteCounter {
  private bytes = 0;
  constructor(private readonly maxBytes: number) {}

  get total(): number {
    return this.bytes;
  }

  transform = (chunk: Uint8Array, controller: TransformStreamDefaultController): void => {
    this.bytes += chunk.byteLength;
    if (this.bytes > this.maxBytes) {
      controller.error(new MaxBodySizeError(this.maxBytes));
      return;
    }
    controller.enqueue(chunk);
  };
}

/**
 * Wrap a `ReadableStream<Uint8Array>` with a `ByteCounter` transform. The
 * returned stream errors with `MaxBodySizeError` if the cap is exceeded.
 */
export function withByteCap(
  source: ReadableStream<Uint8Array>,
  maxBytes: number,
): { stream: ReadableStream<Uint8Array>; counter: ByteCounter } {
  const counter = new ByteCounter(maxBytes);
  const transform = new TransformStream<Uint8Array, Uint8Array>({
    transform: (chunk, controller) => counter.transform(chunk, controller),
  });
  return { stream: source.pipeThrough(transform), counter };
}
