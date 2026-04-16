import { createSpanId, createTraceId, logClientEvent } from './telemetry';
import { getCurrentLocale } from '../stores/locale';
import { useAuthStore } from '../stores/auth';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787';

interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string; traceId?: string };
}

interface ApiRequestOptions extends RequestInit {
  token?: string;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 15000;

async function handleUnauthorized() {
  const state = useAuthStore.getState();
  state.logout();
  if (typeof window !== 'undefined') {
    window.location.href = '/login?error=session_expired';
  }
}

export async function apiRequest<T>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
  const { token, timeoutMs, ...requestInit } = options;
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(new DOMException('Request timeout')),
    timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );
  if (requestInit.signal) {
    requestInit.signal.addEventListener(
      'abort',
      () => controller.abort(requestInit.signal!.reason),
      {
        once: true,
      },
    );
  }

  const traceId = createTraceId();
  const spanId = createSpanId();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'X-Trace-Id': traceId,
    'X-Span-Id': spanId,
    'Accept-Language': getCurrentLocale(),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...requestInit.headers,
  };

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...requestInit,
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (response.status === 401 && !endpoint.includes('/api/access/request') && !endpoint.includes('/api/admin/login')) {
      await handleUnauthorized();
      throw new Error('Session expired');
    }

    let data: ApiResponse<T> | undefined;
    try {
      data = (await response.json()) as ApiResponse<T>;
    } catch (error) {
      logClientEvent({
        level: 'error',
        event: 'api.invalid-json',
        traceId,
        spanId,
        metadata: { endpoint, status: response.status },
        error: {
          name: (error as Error).name,
          message: (error as Error).message,
          stack: (error as Error).stack,
        },
      });
      throw new Error('Invalid server response');
    }

    if (!data.ok) {
      const errorMessage = data.error?.message ?? 'Request failed';
      const apiError = new Error(errorMessage);
      (apiError as Error & { traceId?: string }).traceId =
        data.error?.traceId ?? response.headers.get('x-trace-id') ?? traceId;
      logClientEvent({
        level: 'error',
        event: 'api.error',
        traceId,
        spanId,
        metadata: { endpoint, status: response.status },
        error: { name: apiError.name, message: apiError.message, stack: apiError.stack },
      });
      throw apiError;
    }

    logClientEvent({
      level: 'info',
      event: 'api.success',
      traceId,
      spanId,
      metadata: { endpoint, status: response.status },
    });

    return data.data as T;
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      logClientEvent({
        level: 'error',
        event: 'api.timeout',
        traceId,
        spanId,
        metadata: { endpoint },
        error: { name: (error as Error).name, message: (error as Error).message },
      });
    } else {
      logClientEvent({
        level: 'error',
        event: 'api.network-error',
        traceId,
        spanId,
        metadata: { endpoint },
        error: {
          name: (error as Error).name,
          message: (error as Error).message,
          stack: (error as Error).stack,
        },
      });
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export const api = {
  async get(endpoint: string, options?: ApiRequestOptions): Promise<Response> {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept-Language': getCurrentLocale(),
        ...options?.headers,
      },
      ...options,
    });
    if (res.status === 401 && !endpoint.includes('/api/access/request')) {
       await handleUnauthorized();
    }
    return res;
  },
  async post(endpoint: string, data?: unknown, options?: ApiRequestOptions): Promise<Response> {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept-Language': getCurrentLocale(),
        ...options?.headers,
      },
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    });
    if (res.status === 401 && !endpoint.includes('/api/access/request')) {
       await handleUnauthorized();
    }
    return res;
  },
  async put(endpoint: string, data?: unknown, options?: ApiRequestOptions): Promise<Response> {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Accept-Language': getCurrentLocale(),
        ...options?.headers,
      },
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    });
    if (res.status === 401) {
       await handleUnauthorized();
    }
    return res;
  },
  async delete(endpoint: string, options?: ApiRequestOptions): Promise<Response> {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Accept-Language': getCurrentLocale(),
        ...options?.headers,
      },
      ...options,
    });
    if (res.status === 401) {
       await handleUnauthorized();
    }
    return res;
  },
};

export function getApiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}
