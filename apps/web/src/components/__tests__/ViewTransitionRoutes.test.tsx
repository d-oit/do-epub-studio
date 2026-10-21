import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, useNavigate } from 'react-router-dom';

const logClientEvent = vi.fn();

vi.mock('../../lib/client-logger', () => ({
  logClientEvent: (entry: unknown) => logClientEvent(entry),
}));

import { ViewTransitionRoutes } from '../ViewTransitionRoutes';

describe('ViewTransitionRoutes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the matched route', () => {
    render(
      <MemoryRouter initialEntries={['/test']}>
        <ViewTransitionRoutes>
          <Route path="/test" element={<div>Test Page</div>} />
          <Route path="/other" element={<div>Other Page</div>} />
        </ViewTransitionRoutes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Test Page')).toBeInTheDocument();
  });

  it('renders 404 when no route matches', () => {
    render(
      <MemoryRouter initialEntries={['/unknown']}>
        <ViewTransitionRoutes>
          <Route path="/test" element={<div>Test Page</div>} />
        </ViewTransitionRoutes>
      </MemoryRouter>,
    );
    expect(screen.queryByText('Test Page')).not.toBeInTheDocument();
  });

  it('uses startViewTransition when API is available', () => {
    const mockStartViewTransition = vi.fn((cb: () => void) => {
      cb();
      return {
        finished: Promise.resolve(),
        ready: Promise.resolve(),
        updateCallbackDone: Promise.resolve(),
      };
    });
    vi.stubGlobal('startViewTransition', mockStartViewTransition);
    Object.defineProperty(document, 'startViewTransition', {
      value: mockStartViewTransition,
      writable: true,
      configurable: true,
    });

    render(
      <MemoryRouter initialEntries={['/first']}>
        <ViewTransitionRoutes>
          <Route path="/first" element={<div>First Page</div>} />
        </ViewTransitionRoutes>
      </MemoryRouter>,
    );

    expect(screen.getByText('First Page')).toBeInTheDocument();
  });

  it('consumes a skipped transition rejection instead of leaving it unhandled', async () => {
    // A navigation that supersedes an in-flight view transition rejects the
    // transition's `ready` promise with an AbortError. Left unconsumed it
    // surfaces as an unhandled promise rejection in the page.
    const mockStartViewTransition = vi.fn((cb: () => void) => {
      cb();
      return {
        finished: Promise.resolve(),
        ready: Promise.reject(new DOMException('Transition was skipped', 'AbortError')),
        updateCallbackDone: Promise.resolve(),
      };
    });
    Object.defineProperty(document, 'startViewTransition', {
      value: mockStartViewTransition,
      writable: true,
      configurable: true,
    });

    const unhandled: unknown[] = [];
    const onUnhandled = (event: PromiseRejectionEvent) => {
      unhandled.push(event.reason);
      event.preventDefault();
    };
    window.addEventListener('unhandledrejection', onUnhandled);

    try {
      function NavigateAway() {
        const navigate = useNavigate();
        return (
          <button type="button" onClick={() => navigate('/second')}>
            go
          </button>
        );
      }

      render(
        <MemoryRouter initialEntries={['/first']}>
          <ViewTransitionRoutes>
            <Route path="/first" element={<NavigateAway />} />
            <Route path="/second" element={<div>Second Page</div>} />
          </ViewTransitionRoutes>
        </MemoryRouter>,
      );

      await act(async () => {
        screen.getByRole('button', { name: 'go' }).click();
        await Promise.resolve();
      });
      // Drain the microtask queue twice so an unconsumed rejection would be
      // reported to the listener installed above.
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(mockStartViewTransition).toHaveBeenCalled();
      expect(unhandled).toEqual([]);
    } finally {
      window.removeEventListener('unhandledrejection', onUnhandled);
    }
  });

  it('reports a failing update callback instead of swallowing it', async () => {
    const mockStartViewTransition = vi.fn((cb: () => void) => {
      cb();
      return {
        finished: Promise.resolve(),
        ready: Promise.resolve(),
        updateCallbackDone: Promise.reject(new Error('route render failed')),
      };
    });
    Object.defineProperty(document, 'startViewTransition', {
      value: mockStartViewTransition,
      writable: true,
      configurable: true,
    });

    function NavigateAway() {
      const navigate = useNavigate();
      return (
        <button type="button" onClick={() => navigate('/second')}>
          go
        </button>
      );
    }

    render(
      <MemoryRouter initialEntries={['/first']}>
        <ViewTransitionRoutes>
          <Route path="/first" element={<NavigateAway />} />
          <Route path="/second" element={<div>Second Page</div>} />
        </ViewTransitionRoutes>
      </MemoryRouter>,
    );

    await act(async () => {
      screen.getByRole('button', { name: 'go' }).click();
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockStartViewTransition).toHaveBeenCalled();
    expect(logClientEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'error',
        event: 'view_transition.update_failed',
        error: expect.objectContaining({ message: 'route render failed' }),
      }),
    );
  });

  it('degrades gracefully when startViewTransition is not available', () => {
    Object.defineProperty(document, 'startViewTransition', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    render(
      <MemoryRouter initialEntries={['/fallback']}>
        <ViewTransitionRoutes>
          <Route path="/fallback" element={<div>Fallback Page</div>} />
        </ViewTransitionRoutes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Fallback Page')).toBeInTheDocument();
  });
});
