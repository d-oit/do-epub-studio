import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { createSpanId, createTraceId, logClientEvent } from './lib/telemetry';
import './styles/globals.css';

setupGlobalErrorHandlers();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.log('Service worker registration failed:', error);
    });
  });
}

function setupGlobalErrorHandlers(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.addEventListener('error', (event) => {
    const traceId = createTraceId();
    logClientEvent({
      level: 'error',
      event: 'window.error',
      traceId,
      spanId: createSpanId(),
      error: {
        name: event.error?.name ?? 'Error',
        message: event.error?.message ?? String(event.message),
        stack: event.error?.stack,
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
