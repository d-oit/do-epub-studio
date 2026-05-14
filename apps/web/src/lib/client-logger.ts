export interface ClientLogEntry {
  level: 'info' | 'warn' | 'error';
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
  if (entry.level === 'warn') {
    console.warn(payload);
    return;
  }
  console.log(payload);
}
