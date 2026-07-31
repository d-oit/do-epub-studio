import { createSpanId, createTraceId } from '@do-epub-studio/shared';
import { logClientEvent } from '../client-logger';
import { getCurrentLocale } from '../../stores/locale';
import { useAuthStore } from '../../stores/auth';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787';

interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string; traceId?: string };
}

export interface ApiRequestOptions extends RequestInit {
  token?: string;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 15000;
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 200;

/** Retries on network errors (TypeError) and 5xx; not on 4xx or timeouts. */
function isRetryable(error: unknown, status?: number): boolean {
  if (status && status >= 500) return true;
  if (error instanceof TypeError && error.message !== 'Request timeout') return true;
  return false;
}

/** Exponential backoff: 200ms, 400ms, 800ms. */
function backoff(attempt: number): Promise<void> {
  const delay = INITIAL_BACKOFF_MS * 2 ** attempt;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

function handleUnauthorized() {
  const state = useAuthStore.getState();
  state.logout('expired');
}

/** Core API request: observability, timeout, retry w/ backoff, error handling. */
export async function apiRequest<T>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
  const { token, timeoutMs, ...requestInit } = options;
  const traceId = createTraceId();
  const spanId = createSpanId();

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await backoff(attempt - 1);
    }

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(new DOMException('Request timeout')),
      timeoutMs ?? DEFAULT_TIMEOUT_MS,
    );

    if (requestInit.signal) {
      requestInit.signal.addEventListener(
        'abort',
        () => requestInit.signal && controller.abort(requestInit.signal.reason),
        { once: true },
      );
    }

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'X-Trace-Id': traceId,
      'X-Span-Id': spanId,
      'Accept-Language': getCurrentLocale(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...requestInit.headers,
    };

    let responseStatus: number | undefined;
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...requestInit,
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      responseStatus = response.status;
      if (response.status === 401 && !endpoint.includes('/api/access/request') && !endpoint.includes('/api/admin/login')) {
        handleUnauthorized();
        throw new Error('Session expired');
      }
      if (response.status >= 500 && attempt < MAX_RETRIES) {
        logClientEvent({ level: 'warn', event: 'api.retry', traceId, spanId, metadata: { endpoint, status: response.status, attempt: attempt + 1 } });
        continue;
      }
      let data: ApiResponse<T> | undefined;
      try {
        data = (await response.json()) as ApiResponse<T>;
      } catch (error) {
        logClientEvent({ level: 'error', event: 'api.parse-error', traceId, spanId, metadata: { endpoint, status: response.status }, error: { name: (error as Error).name, message: (error as Error).message } });
        throw new Error('Invalid server response', { cause: error });
      }
      if (!data.ok) {
        const errorMessage = data.error?.message ?? 'Request failed';
        const apiError = new Error(errorMessage);
        (apiError as Error & { traceId?: string }).traceId = data.error?.traceId ?? response.headers.get('x-trace-id') ?? traceId;
        logClientEvent({ level: 'error', event: 'api.error', traceId, spanId, metadata: { endpoint, status: response.status }, error: { name: apiError.name, message: apiError.message, stack: apiError.stack } });
        throw apiError;
      }
      logClientEvent({ level: 'info', event: 'api.success', traceId, spanId, metadata: { endpoint, status: response.status } });
      return data.data as T;
    } catch (error) {
      clearTimeout(timeout);
      if ((error as Error).name === 'AbortError') {
        logClientEvent({ level: 'error', event: 'api.timeout', traceId, spanId, metadata: { endpoint }, error: { name: (error as Error).name, message: (error as Error).message } });
        throw error;
      }
      if (!isRetryable(error, responseStatus) || attempt >= MAX_RETRIES) {
        logClientEvent({ level: 'error', event: responseStatus && responseStatus >= 500 ? 'api.server-error' : 'api.network-error', traceId, spanId, metadata: { endpoint, attempt: attempt + 1 }, error: { name: (error as Error).name, message: (error as Error).message, stack: (error as Error).stack } });
        throw error;
      }
      logClientEvent({ level: 'warn', event: 'api.retry', traceId, spanId, metadata: { endpoint, attempt: attempt + 1, error: (error as Error).message } });
    }
  }
  throw new Error('Max retries exceeded');
}


/** Non-throwing API helper: returns raw Response w/ observability + 401 handling. */
async function apiRaw(endpoint: string, method: string, data?: unknown, options?: ApiRequestOptions): Promise<Response> {
  const traceId = createTraceId();
  const spanId = createSpanId();
  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Trace-Id': traceId,
      'X-Span-Id': spanId,
      'Accept-Language': getCurrentLocale(),
      ...options?.headers,
    },
    body: data ? JSON.stringify(data) : undefined,
    ...options,
  });
  if (res.status === 401 && !endpoint.includes('/api/access/request') && !endpoint.includes('/api/admin/login')) {
    handleUnauthorized();
  }
  logClientEvent({
    level: res.ok ? 'info' : 'error',
    event: res.ok ? 'api-raw.success' : 'api-raw.error',
    traceId,
    spanId,
    metadata: { endpoint, method, status: res.status },
  });
  return res;
}

/** Convenience API helper methods for direct Response access. */
export const api = {
  get: (endpoint: string, options?: ApiRequestOptions) => apiRaw(endpoint, 'GET', undefined, options),
  post: (endpoint: string, data?: unknown, options?: ApiRequestOptions) => apiRaw(endpoint, 'POST', data, options),
  put: (endpoint: string, data?: unknown, options?: ApiRequestOptions) => apiRaw(endpoint, 'PUT', data, options),
  delete: (endpoint: string, options?: ApiRequestOptions) => apiRaw(endpoint, 'DELETE', undefined, options),
};

export function getApiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}