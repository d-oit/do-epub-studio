import { Component, type ErrorInfo, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createTraceId } from '@do-epub-studio/shared';
import { Button } from '../button';
import { Card } from '../card';
import { PageContainer } from '../page-container';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onCatch?: (error: Error, errorInfo: ErrorInfo, traceId: string) => void;
  translations?: {
    heading: string;
    description: string;
    retry: string;
    home: string;
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
    isRetrying: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error, traceId: createTraceId() };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const traceId = this.state.traceId ?? createTraceId();
    this.props.onCatch?.(error, errorInfo, traceId);
  }

  public handleRetry = (): void => {
    this.setState({ isRetrying: true });
    setTimeout(() => {
      this.setState({ hasError: false, error: undefined, traceId: undefined, isRetrying: false });
    }, 600);
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const t = this.props.translations ?? {
        heading: 'Something went wrong',
        description: 'We couldn’t load this page. Please try again or go back to your library.',
        retry: 'Try again',
        home: 'Go to library',
      };

      return (
        <PageContainer className="flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
          <AnimatePresence mode="wait">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="max-w-md w-full text-center"
            >
              <Card className="p-8 space-y-6 shadow-xl border-red-100 dark:border-red-900/30">
                <div className="w-20 h-20 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-2">
                  <svg
                    className="w-10 h-10"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                    />
                  </svg>
                </div>

                <div className="space-y-2">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {t.heading}
                  </h1>
                  <p className="text-gray-500 dark:text-gray-400 leading-relaxed">
                    {t.description}
                  </p>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 border border-gray-100 dark:border-gray-700">
                  <p className="text-[10px] font-mono text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">
                    Error ID
                  </p>
                  <code className="text-xs font-mono text-red-600 dark:text-red-400 select-all">
                    {this.state.traceId}
                  </code>
                </div>

                <div className="pt-4 flex flex-col gap-3">
                  <Button
                    onClick={this.handleRetry}
                    disabled={this.state.isRetrying}
                    className="w-full bg-primary-600 hover:bg-primary-700 text-white"
                  >
                    {this.state.isRetrying ? '...' : t.retry}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => (window.location.href = '/')}
                    className="w-full text-gray-600 dark:text-gray-400"
                  >
                    {t.home}
                  </Button>
                </div>
              </Card>
            </motion.div>
          </AnimatePresence>
        </PageContainer>
      );
    }

    return this.props.children;
  }
}
