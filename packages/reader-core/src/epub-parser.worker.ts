/// <reference lib="WebWorker" />

import { createTraceId } from '@do-epub-studio/shared';
import { validateArchive } from './archive-validator';

const PARSE_VALIDATION_TIMEOUT_MS = 10_000;

interface ParseRequest {
  type: 'parse';
  id: string;
  source: string | Uint8Array;
}

interface ResultMessage {
  type: 'result';
  id: string;
  result: {
    valid: boolean;
    error?: string;
    data?: ArrayBuffer;
  };
}

async function fallbackParse(
  data: Uint8Array,
  traceId: string,
): Promise<void> {
  await validateArchive(data, {
    timeoutMs: PARSE_VALIDATION_TIMEOUT_MS,
    traceId,
  });
}

self.onmessage = async (event: MessageEvent<ParseRequest>) => {
  const { type, id, source } = event.data;

  if (type === 'parse') {
    try {
      const traceId = createTraceId();
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

      await fallbackParse(data, traceId);

      const msg: ResultMessage = {
        type: 'result',
        id,
        result: {
          valid: true,
          data: data.buffer as ArrayBuffer,
        },
      };
      self.postMessage(msg, [data.buffer]);
    } catch (error) {
      const msg: ResultMessage = {
        type: 'result',
        id,
        result: {
          valid: false,
          error: error instanceof Error ? error.message : String(error),
        },
      };
      self.postMessage(msg);
    }
  }
};
