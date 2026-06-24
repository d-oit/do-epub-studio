export interface ClientLogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
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

type LogLevel = ClientLogEntry['level'];

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function getMinLevel(): number {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    const envLevel = import.meta.env.VITE_LOG_LEVEL as LogLevel | undefined;
    if (envLevel && envLevel in LOG_LEVELS) return LOG_LEVELS[envLevel];
  }
  return LOG_LEVELS.warn;
}

const _buffer: ClientLogEntry[] = [];
let _flushTimer: ReturnType<typeof setTimeout> | null = null;

function flushBuffer(): void {
  if (_buffer.length === 0) return;
  const endpoint = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_TELEMETRY_ENDPOINT) || '/api/telemetry';

  try {
    const payload = JSON.stringify({ logs: _buffer.splice(0) });
    const isBrowser = typeof window !== 'undefined';
    if (!isBrowser && !endpoint.startsWith('http')) return;

    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon(endpoint, new Blob([payload], { type: 'application/json' }));
    } else if (typeof fetch !== 'undefined') {
      void fetch(endpoint, { method: 'POST', body: payload, keepalive: true }).catch(() => {});
    }
  } catch {
    // Silently fail
  }
}

function scheduleFlush(): void {
  if (_flushTimer) return;
  _flushTimer = setTimeout(() => {
    _flushTimer = null;
    flushBuffer();
  }, 1000);
}

if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushBuffer();
  });
  window.addEventListener('beforeunload', flushBuffer);
}

export function logClientEvent(entry: ClientLogEntry): void {
  const minLevel = getMinLevel();
  if (LOG_LEVELS[entry.level] < minLevel) return;

  const payload = JSON.stringify(entry);
  if (entry.level === 'error') {
    console.error(payload);
  } else if (entry.level === 'warn') {
    console.warn(payload);
  } else {
    console.log(payload);
  }

  if (entry.level === 'warn' || entry.level === 'error') {
    _buffer.push(entry);
    scheduleFlush();
  }
}

export function createPerformanceMark(name: string): void {
  if (typeof performance !== 'undefined' && performance.mark) {
    performance.mark(name);
  }
}

export function measurePerformance(name: string, startMark: string, endMark: string): number | undefined {
  if (typeof performance === 'undefined' || !performance.measure) return undefined;
  try {
    performance.measure(name, startMark, endMark);
    const entries = performance.getEntriesByName(name);
    return entries.length > 0 ? entries[entries.length - 1].duration : undefined;
  } catch {
    return undefined;
  }
}
