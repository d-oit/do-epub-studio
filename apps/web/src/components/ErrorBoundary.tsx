import { Component, type ErrorInfo, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createSpanId, createTraceId } from '@do-epub-studio/shared';
import { logClientEvent } from '../lib/client-logger';
import { Button, Card } from './ui';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onCatch?: (error: Error, errorInfo: ErrorInfo, traceId: string) => void;
  translations?: {
    heading?: string;
    description?: string;
    retry?: string;
    home?: string;
  };
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  traceId?: string;
  isRetrying: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    isRetrying: false
  };

  public static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error, traceId: createTraceId() };
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
    this.props.onCatch?.(error, errorInfo, traceId);
  }

  public handleRetry = (): void => {
    this.setState({ isRetrying: true });
    // Simulate a brief delay for UX before clearing error
    setTimeout(() => {
      this.setState({ hasError: false, error: undefined, traceId: undefined, isRetrying: false });
    }, 600);
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center">
          <AnimatePresence mode="wait">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 1.1 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="max-w-md w-full"
            >
              <Card className="glass-panel p-8 space-y-6 shadow-glass-lg border-accent-error/20">
                <div className="w-16 h-16 bg-accent-error/10 text-accent-error rounded-full flex items-center justify-center mx-auto mb-2">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>

                <div className="space-y-2">
                  <h1 className="text-xl font-bold text-foreground">
                    {this.props.translations?.heading ?? 'Something went wrong'}
                  </h1>
                  <p className="text-sm text-foreground-muted leading-relaxed">
                    {this.props.translations?.description ?? 'An unexpected error occurred. You can try to reload the component or contact support with the ID below.'}
                  </p>
                </div>

                <div className="bg-background-secondary rounded-lg p-3 border border-border">
                  <p className="text-[10px] font-mono text-foreground-muted uppercase tracking-wider mb-1">Trace ID</p>
                  <code className="text-xs font-mono text-accent select-all">{this.state.traceId}</code>
                </div>

                <div className="pt-4 flex flex-col gap-3">
                  <Button
                    onClick={this.handleRetry}
                    disabled={this.state.isRetrying}
                    className="w-full"
                  >
                    {this.state.isRetrying ? 'Retrying...' : (this.props.translations?.retry ?? 'Try Again')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.location.reload()}
                    className="text-foreground-muted"
                  >
                    {this.props.translations?.home ?? 'Reload Page'}
                  </Button>
                </div>
              </Card>
            </motion.div>
          </AnimatePresence>
        </div>
      );
    }

    return this.props.children;
  }
}
