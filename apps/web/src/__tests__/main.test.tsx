import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockRender = vi.fn();
const mockCreateRoot = vi.fn((_el: HTMLElement) => ({
  render: mockRender,
}));

vi.mock('react-dom/client', () => ({
  default: {
    createRoot: mockCreateRoot,
  },
  createRoot: mockCreateRoot,
}));

vi.mock('@do-epub-studio/shared', () => ({
  createTraceId: () => 'test-trace',
  createSpanId: () => 'test-span',
}));

vi.mock('../lib/client-logger', () => ({
  logClientEvent: vi.fn(),
}));

vi.mock('@do-epub-studio/ui', async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Vitest mock pattern requires runtime import()
  const actual = await importOriginal<typeof import('@do-epub-studio/ui')>();
  return {
    ...actual,
    ToastProvider: ({ children }: { children: React.ReactNode }) => children,
    useToast: () => ({
      addToast: vi.fn(),
      removeToast: vi.fn(),
      toasts: [],
    }),
  };
});

vi.mock('../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    locale: 'en',
    setLocale: vi.fn(),
  }),
}));

vi.mock('../components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('../stores/sw-update', () => ({
  useSwUpdateStore: Object.assign(
    (selector: (s: Record<string, unknown>) => unknown) => {
      const state = {
        setNeedRefresh: vi.fn(),
        setOfflineReady: vi.fn(),
        dismiss: vi.fn(),
        needRefresh: false,
        offlineReady: false,
        updateServiceWorker: null,
      };
      return selector(state);
    },
    { getState: () => ({ setNeedRefresh: vi.fn(), setOfflineReady: vi.fn() }) },
  ),
}));

const mockRegisterSW = vi.fn();
vi.mock('virtual:pwa-register', () => ({
  registerSW: (options: unknown) => mockRegisterSW(options),
}));

describe('main.tsx', () => {
  let addEventListenerSpy: ReturnType<typeof vi.spyOn>;
  let errorListeners: Array<(...args: unknown[]) => void> = [];
  let rejectionListeners: Array<(...args: unknown[]) => void> = [];
  let loadListeners: Array<(...args: unknown[]) => void> = [];
  let originalNavigator: typeof navigator;
  let mockServiceWorker: any;

  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '<div id="root"></div>';
    vi.resetModules();
    delete (window as unknown as Record<string, unknown>).__errorHandlerRegistered;

    errorListeners = [];
    rejectionListeners = [];
    loadListeners = [];

    addEventListenerSpy = vi.spyOn(window, 'addEventListener').mockImplementation(
      (event: string, listener: any) => {
        if (event === 'error') errorListeners.push(listener);
        else if (event === 'unhandledrejection') rejectionListeners.push(listener);
        else if (event === 'load') loadListeners.push(listener);
        return undefined;
      },
    );

    originalNavigator = globalThis.navigator;
    mockServiceWorker = {
      register: vi.fn().mockResolvedValue({
        sync: { register: vi.fn().mockResolvedValue(undefined) },
      }),
    };
    Object.defineProperty(globalThis, 'navigator', {
      value: { ...originalNavigator, serviceWorker: mockServiceWorker },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    addEventListenerSpy?.mockRestore();
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      configurable: true,
      writable: true,
    });
  });

  it('renders without crashing', async () => {
    await import('../main');
    expect(mockCreateRoot).toHaveBeenCalled();
  });

  describe('global error handlers', () => {
    it('error handler logs client event', async () => {
      document.body.innerHTML = '<div id="root"></div>';
      await import('../main');
      const { logClientEvent } = await import('../lib/client-logger');

      const testError = new Error('test error');
      const errorEvent = new ErrorEvent('error', {
        error: testError,
        message: 'test error',
        filename: 'test.js',
        lineno: 10,
        colno: 5,
      });

      errorListeners[0]?.(errorEvent);
      expect(logClientEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'error',
          event: 'window.error',
          error: expect.objectContaining({
            name: 'Error',
            message: 'test error',
          }),
        }),
      );
    });

    it('unhandledrejection handler logs client event', async () => {
      document.body.innerHTML = '<div id="root"></div>';
      await import('../main');
      const { logClientEvent } = await import('../lib/client-logger');

      const testError = new Error('rejection error');
      const rejectedPromise = Promise.reject(testError);
      rejectedPromise.catch(() => {});
      const rejectionEvent = new PromiseRejectionEvent('unhandledrejection', {
        reason: testError,
        promise: rejectedPromise,
      });

      rejectionListeners[0]?.(rejectionEvent);
      expect(logClientEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'error',
          event: 'window.unhandledrejection',
          error: expect.objectContaining({
            name: 'Error',
            message: 'rejection error',
          }),
        }),
      );
    });

    it('handles non-Error rejection reason gracefully', async () => {
      document.body.innerHTML = '<div id="root"></div>';
      await import('../main');
      const { logClientEvent } = await import('../lib/client-logger');

      const stringReason = 'string error';
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- intentional: test the handler's tolerance for non-Error rejection reasons
      const rejectedPromise = Promise.reject(stringReason);
      rejectedPromise.catch(() => {});
      const rejectionEvent = new PromiseRejectionEvent('unhandledrejection', {
        reason: stringReason,
        promise: rejectedPromise,
      });

      rejectionListeners[0]?.(rejectionEvent);
      expect(logClientEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'error',
          event: 'window.unhandledrejection',
          error: expect.objectContaining({
            name: 'Error',
            message: 'string error',
          }),
        }),
      );
    });
  });

  describe('service worker', () => {
    it('registers service worker with registerSW and callbacks', async () => {
      document.body.innerHTML = '<div id="root"></div>';
      await import('../main');

      expect(mockRegisterSW).toHaveBeenCalledWith(
        expect.objectContaining({
          immediate: true,
          onNeedRefresh: expect.any(Function),
          onOfflineReady: expect.any(Function),
        }),
      );

      const registeredCall = mockRegisterSW.mock.calls[0]?.[0];
      expect(registeredCall).toBeDefined();

      if (registeredCall && typeof registeredCall.onRegistered === 'function') {
        const mockSyncRegister = vi.fn().mockResolvedValue(undefined);
        const mockRegistration = {
          sync: {
            register: mockSyncRegister,
          },
        };

        registeredCall.onRegistered(mockRegistration);
        expect(mockSyncRegister).toHaveBeenCalledWith('sync-reader-state');
      }
    });

    it('skips service worker registration when not available', async () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: { ...originalNavigator },
        configurable: true,
        writable: true,
      });

      document.body.innerHTML = '<div id="root"></div>';
      await import('../main');
      expect(mockRegisterSW).not.toHaveBeenCalled();
    });
  });

  describe('SSR guard', () => {
    it('setupGlobalErrorHandlers returns early when window is undefined', async () => {
      document.body.innerHTML = '<div id="root"></div>';

      const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
      Object.defineProperty(globalThis, 'window', {
        value: undefined,
        configurable: true,
        writable: true,
      });

      vi.resetModules();
      await import('../main');

      expect(mockCreateRoot).toHaveBeenCalled();

      if (originalDescriptor) {
        Object.defineProperty(globalThis, 'window', originalDescriptor);
      }
    });
  });
});
