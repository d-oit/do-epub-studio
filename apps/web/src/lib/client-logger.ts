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

const MAX_BUFFER_SIZE = 100;

const _buffer: ClientLogEntry[] = [];
let _flushTimer: ReturnType<typeof setTimeout> | null = null;
let _dropCount = 0;

function flushBuffer(): void {
  if (_buffer.length === 0) return;
  const endpoint = typeof import.meta !== 'undefined' && import.meta.env?.VITE_TELEMETRY_ENDPOINT;
  if (!endpoint) {
    _buffer.length = 0;
    return;
  }

  try {
    const logs = _buffer.splice(0);
    const dropped = _dropCount;
    _dropCount = 0;
    const payload = JSON.stringify({ logs, dropped });
    const isBrowser = typeof window !== 'undefined';
    if (!isBrowser && !endpoint.startsWith('http')) return;

    const blob = new Blob([payload], { type: 'application/json' });
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const sent = navigator.sendBeacon(endpoint, blob);
      if (!sent && typeof fetch !== 'undefined') {
        void fetch(endpoint, { method: 'POST', body: payload, keepalive: true }).catch(() => {});
      }
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
    if (_buffer.length >= MAX_BUFFER_SIZE) {
      _buffer.shift();
      _dropCount++;
    }
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

export type PerformanceEntryCallback = (entry: PerformanceEntry) => void;

export function observePerformance(callback: PerformanceEntryCallback): PerformanceObserver | undefined {
  if (typeof PerformanceObserver === 'undefined') return undefined;
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        callback(entry);
      }
    });
    observer.observe({ type: 'mark', buffered: false });
    observer.observe({ type: 'measure', buffered: false });
    return observer;
  } catch {
    return undefined;
  }
}

function percentile(sorted: number[], p: number): number | undefined {
  if (sorted.length === 0) return undefined;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

export interface PerformanceMetrics {
  p50: number | undefined;
  p95: number | undefined;
  p99: number | undefined;
  count: number;
}

export function reportPerformanceMetrics(
  metricPrefix: string,
  logFn: (metrics: PerformanceMetrics) => void,
): void {
  if (typeof performance === 'undefined') return;
  const entries = performance.getEntriesByName(metricPrefix);
  if (entries.length === 0) return;
  const durations = entries.map((e) => e.duration).sort((a, b) => a - b);
  logFn({
    p50: percentile(durations, 50),
    p95: percentile(durations, 95),
    p99: percentile(durations, 99),
    count: durations.length,
  });
}
