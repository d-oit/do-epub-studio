import * as Sentry from '@sentry/react';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import { App } from './App';
import { createSpanId, createTraceId } from '@do-epub-studio/shared';
import { ToastProvider, useToast } from '@do-epub-studio/ui';
import { ErrorBoundary } from './components/ErrorBoundary';
import { logClientEvent } from './lib/client-logger';
import './styles/globals.css';

// Init before anything else; no-op if DSN is absent
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    tracesSampleRate: 0.1,
    environment: import.meta.env.MODE,
    integrations: [Sentry.browserTracingIntegration()],
  });
}
import { registerSW } from 'virtual:pwa-register';
import { useSwUpdateStore } from './stores/sw-update';
import { useTranslation } from './hooks/useTranslation';
import type { TranslationKeys } from './i18n';

let _addToast: ((type: 'success' | 'error' | 'info' | 'warning', message: string) => void) | null = null;
let _t: ((key: TranslationKeys) => string) | null = null;

export function setErrorToastProvider(
  addToast: (type: 'success' | 'error' | 'info' | 'warning', message: string) => void,
  t: (key: TranslationKeys) => string,
) {
  _addToast = addToast;
  _t = t;
}

export function handleError(event: ErrorEvent) {
  const error = event.error instanceof Error ? event.error : new Error(String(event.error));

  // Suppress Workbox SW errors thrown in async callbacks (setTimeout, etc.)
  // These are synchronous exceptions, not promise rejections, so handleRejection
  // cannot catch them.  The crash occurs inside workbox-window's _onStateChange
  // handler when self.registration is undefined (e.g. Playwright blocks SWs).
  const stack = error.stack ?? '';
  if (stack.includes('workbox') || error.message.includes('waiting')) {
    event.preventDefault();
    return;
  }

  const traceId = createTraceId();
  logClientEvent({
    level: 'error',
    event: 'window.error',
    traceId,
    spanId: createSpanId(),
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    metadata: { filename: event.filename, lineno: event.lineno, colno: event.colno },
  });

  if (import.meta.env.PROD) {
    event.preventDefault();
  }

  _addToast?.('error', _t?.('errors.generic') ?? 'An unexpected error occurred');
}

export function handleRejection(event: PromiseRejectionEvent) {
  const reason = event.reason instanceof Error ? event.reason : new Error(String(event.reason));

  // Suppress Workbox SW registration errors — these occur when service
  // workers are blocked (e.g. Playwright's serviceWorkers: 'block')
  // and cause a non-actionable "Cannot read properties of undefined
  // (reading 'waiting')" crash inside workbox-window.
  const stack = reason.stack ?? '';
  if (stack.includes('workbox') || reason.message.includes('waiting')) {
    event.preventDefault();
    return;
  }

  const traceId = createTraceId();
  logClientEvent({
    level: 'error',
    event: 'window.unhandledrejection',
    traceId,
    spanId: createSpanId(),
    error: { name: reason.name, message: reason.message, stack: reason.stack },
  });

  if (import.meta.env.PROD) {
    event.preventDefault();
  }

  _addToast?.('error', _t?.('errors.generic') ?? 'An unexpected error occurred');
}

export const ToastBridge = () => {
  const { t } = useTranslation();
  const { addToast } = useToast();

  React.useEffect(() => {
    setErrorToastProvider(addToast, t);
  }, [addToast, t]);

  return null;
};

export const Root = () => {
  const { t } = useTranslation();

  return (
    <React.StrictMode>
      <ToastProvider>
        <ToastBridge />
        <ErrorBoundary
          translations={{
            heading: t('errors.boundary.title'),
            description: t('errors.boundary.description'),
            retry: t('common.retry'),
            home: t('errors.boundary.home'),
          }}
        >
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ErrorBoundary>
      </ToastProvider>
    </React.StrictMode>
  );
};


const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(<Root />);
}

if (typeof window !== 'undefined') {
  window.addEventListener('error', handleError);
  window.addEventListener('unhandledrejection', handleRejection);
}

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      useSwUpdateStore.getState().setNeedRefresh(() => updateSW);
    },
    onOfflineReady() {
      useSwUpdateStore.getState().setOfflineReady(true);
    },
    onRegistered(registration) {
      if (registration) {
        // Background Sync API is not yet on the standard ServiceWorkerRegistration
        // type; extend it locally and feature-check before calling.
        const syncReg = registration as ServiceWorkerRegistration & {
          sync?: {
            register(tag: string): Promise<void>;
          };
        };
        const sync = syncReg.sync;
        if (sync) {
          const registerSync = () => {
            void sync.register('sync-reader-state').catch((err: unknown) => {
              const error = err instanceof Error ? err : new Error(String(err));
              logClientEvent({
                level: 'error',
                event: 'sw.background_sync_register_failed',
                traceId: createTraceId(),
                spanId: createSpanId(),
                error: { name: error.name, message: error.message, stack: error.stack },
              });
            });
          };
          // Background Sync registration requires an ACTIVE worker; calling it
          // during first install throws InvalidStateError
          // ("no active Service Worker"). Defer until activation completes.
          if (registration.active) {
            registerSync();
          } else {
            const worker = registration.installing ?? registration.waiting;
            if (worker) {
              worker.addEventListener('statechange', function onStateChange() {
                if (worker.state === 'activated') {
                  worker.removeEventListener('statechange', onStateChange);
                  registerSync();
                }
              });
            }
          }
        }
      }
    },
    onRegisterError(error) {
      const err = error instanceof Error ? error : new Error(String(error));
      // Suppress workbox-window's internal "Cannot read properties of undefined
      // (reading 'waiting')" error that fires when Playwright blocks SW
      // registration.  Match the exact error text to avoid swallowing real
      // registration failures whose messages happen to mention "waiting".
      const stack = err.stack ?? '';
      if (
        stack.includes('workbox') ||
        err.message === "Cannot read properties of undefined (reading 'waiting')"
      ) {
        return;
      }
      logClientEvent({
        level: 'error',
        event: 'sw.registration_failed',
        traceId: createTraceId(),
        spanId: createSpanId(),
        error: { name: err.name, message: err.message, stack: err.stack },
      });
    },
  });
}
