import { Component, type ErrorInfo, type ReactNode } from 'react';

import { createSpanId, createTraceId, logClientEvent } from '../lib/telemetry';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  traceId?: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false };

  public static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true, traceId: createTraceId() };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const traceId = this.state.traceId ?? createTraceId();
    logClientEvent({
      level: 'error',
      event: 'ui.error-boundary',
      traceId,
      spanId: createSpanId(),
      error: { name: error.name, message: error.message, stack: error.stack },
      metadata: { componentStack: errorInfo.componentStack },
    });
  }

  public handleRetry = (): void => {
    this.setState({ hasError: false, traceId: undefined });
  };

  public render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 text-center">
        <div className="max-w-md space-y-4">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Something went wrong
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Please try again. If the issue persists, share this ID with support:{' '}
            <code>{this.state.traceId}</code>
          </p>
          <button
            type="button"
            onClick={this.handleRetry}
            className="px-4 py-2 bg-primary-600 text-white rounded-md shadow hover:bg-primary-700"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }
}
