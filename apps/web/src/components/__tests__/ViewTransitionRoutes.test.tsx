import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route } from 'react-router-dom';
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
