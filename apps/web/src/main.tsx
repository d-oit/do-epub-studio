import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';

import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { createSpanId, createTraceId } from '@do-epub-studio/shared';
import { logClientEvent } from './lib/client-logger';
import './styles/globals.css';
import { registerSW } from 'virtual:pwa-register';

setupGlobalErrorHandlers();

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ErrorBoundary>
        <BrowserRouter>
          <MotionConfig reducedMotion="user">
            <App />
          </MotionConfig>
        </BrowserRouter>
      </ErrorBoundary>
    </React.StrictMode>,
  );
}

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  registerSW({
    immediate: true,
    onRegistered(registration) {
      if (registration) {
        const syncReg = registration as unknown as {
          sync?: {
            register(tag: string): Promise<void>;
          };
        };
        if (syncReg.sync) {
          void syncReg.sync.register('sync-reader-state').catch((err: unknown) => {
            console.error('Failed to register background sync:', err);
          });
        }
      }
    },
    onRegisterError(error) {
      console.error('Service worker registration failed:', error);
    },
  });
}

function setupGlobalErrorHandlers(): void {
  if (typeof window === 'undefined') return;

  const win = window as unknown as { __errorHandlerRegistered?: boolean };
  if (win.__errorHandlerRegistered) return;
  win.__errorHandlerRegistered = true;

  window.addEventListener('error', (event) => {
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
  });

  window.addEventListener('unhandledrejection', (event) => {
    const traceId = createTraceId();
    const reason = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
    logClientEvent({
      level: 'error',
      event: 'window.unhandledrejection',
      traceId,
      spanId: createSpanId(),
      error: { name: reason.name, message: reason.message, stack: reason.stack },
    });
  });
}
