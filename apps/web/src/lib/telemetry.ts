const RANDOM_SOURCE = 'abcdefghijklmnopqrstuvwxyz0123456789';

function randomSegment(length: number): string {
  let result = '';
  for (let i = 0; i < length; i += 1) {
    result += RANDOM_SOURCE.charAt(Math.floor(Math.random() * RANDOM_SOURCE.length));
  }
  return result;
}

export function createTraceId(): string {
  if (crypto?.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${randomSegment(12)}`;
}

export function createSpanId(): string {
  if (crypto?.randomUUID) {
    return crypto.randomUUID().split('-')[0] ?? randomSegment(8);
  }
  return randomSegment(8);
}

export interface ClientLogEntry {
  level: 'info' | 'error';
  traceId: string;
  spanId?: string;
  event: string;
  metadata?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export function logClientEvent(entry: ClientLogEntry): void {
  const payload = JSON.stringify(entry);
  if (entry.level === 'error') {
    console.error(payload);
    return;
  }
  console.log(payload);
}
