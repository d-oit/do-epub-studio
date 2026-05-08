import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { createSpanId, createTraceId, logClientEvent } from './lib/telemetry';
import './styles/globals.css';

setupGlobalErrorHandlers();

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ErrorBoundary>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ErrorBoundary>
    </React.StrictMode>,
  );
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void (async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js');
        const sync = (reg as unknown as { sync?: { register: (tag: string) => Promise<void> } }).sync;
        if (sync) {
          await sync.register('sync-reader-state');
        }
      } catch (error) {
        console.log('Service worker registration failed:', error);
      }
    })();
  });
}

function setupGlobalErrorHandlers(): void {
  if (typeof window === 'undefined') {
    return;
  }

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
