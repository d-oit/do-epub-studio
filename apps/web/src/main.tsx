import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';

import App from './App';
import { createSpanId, createTraceId } from '@do-epub-studio/shared';
import { ToastProvider, useToast } from '@do-epub-studio/ui';
import { ErrorBoundary } from './components/ErrorBoundary';
import { logClientEvent } from './lib/client-logger';
import './styles/globals.css';
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
  const traceId = createTraceId();
  const error = event.error instanceof Error ? event.error : new Error(String(event.error));
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
  const traceId = createTraceId();
  const reason = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
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
            <MotionConfig reducedMotion="user">
              <App />
            </MotionConfig>
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
        const syncReg = registration as unknown as {
          sync?: {
            register(tag: string): Promise<void>;
          };
        };
        if (syncReg.sync) {
          void syncReg.sync.register('sync-reader-state').catch((err: unknown) => {
            const error = err instanceof Error ? err : new Error(String(err));
            logClientEvent({
              level: 'error',
              event: 'sw.background_sync_register_failed',
              traceId: createTraceId(),
              spanId: createSpanId(),
              error: { name: error.name, message: error.message, stack: error.stack },
            });
          });
        }
      }
    },
    onRegisterError(error) {
      const err = error instanceof Error ? error : new Error(String(error));
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
