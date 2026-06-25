import 'fake-indexeddb/auto';
import * as matchers from '@testing-library/jest-dom/matchers';
import { expect, vi, afterEach, afterAll } from 'vitest';
import React from 'react';
import { cleanup } from '@testing-library/react';

expect.extend(matchers);

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Clean up DOM after each test to prevent memory leaks
afterEach(async () => {
  cleanup();
  vi.clearAllMocks();
  // Reset data-cache module-level caches so each test fetches fresh
  // data from the mocked apiRequest. We dynamically import to avoid
  // forcing the module to load in tests that don't need it.
  try {
    const dataCache = await import('./lib/data-cache');
    dataCache._resetAllCaches();
  } catch {
    // Module not loaded in this test; nothing to reset.
  }
});

// Reset data-cache before each test too, to handle test isolation
// issues when multiple test files share the same module instance.
beforeEach(async () => {
  try {
    const dataCache = await import('./lib/data-cache');
    dataCache._resetAllCaches();
  } catch {
    // Module not loaded yet.
  }
});

// Reset module cache after all tests to help with garbage collection
afterAll(() => {
  vi.resetModules();
});

// Simple framer-motion mock - just render as regular elements without Proxy
vi.mock('framer-motion', () => {
  const filterProps = (props: Record<string, unknown>) => {
    const filtered: Record<string, unknown> = {};
    for (const key in props) {
      if (!['whileHover', 'whileTap', 'initial', 'animate', 'exit', 'transition', 'variants', 'layout', 'layoutId'].includes(key)) {
        filtered[key] = props[key];
      } else {
        // Keep animate as a searchable string for tests
        filtered[`data-${key.toLowerCase()}`] = JSON.stringify(props[key]);
      }
    }
    return filtered;
  };

  return {
    motion: {
      div: ({ children, ...props }: { children?: React.ReactNode }) =>
        React.createElement('div', filterProps(props as Record<string, unknown>), children),
      span: ({ children, ...props }: { children?: React.ReactNode }) =>
        React.createElement('span', filterProps(props as Record<string, unknown>), children),
      button: ({ children, ...props }: { children?: React.ReactNode }) =>
        React.createElement('button', filterProps(props as Record<string, unknown>), children),
      input: ({ ...props }) => React.createElement('input', filterProps(props as Record<string, unknown>)),
      header: ({ children, ...props }: { children?: React.ReactNode }) =>
        React.createElement('header', filterProps(props as Record<string, unknown>), children),
      section: ({ children, ...props }: { children?: React.ReactNode }) =>
        React.createElement('section', filterProps(props as Record<string, unknown>), children),
      nav: ({ children, ...props }: { children?: React.ReactNode }) =>
        React.createElement('nav', filterProps(props as Record<string, unknown>), children),
      a: ({ children, ...props }: { children?: React.ReactNode }) =>
        React.createElement('a', filterProps(props as Record<string, unknown>), children),
      p: ({ children, ...props }: { children?: React.ReactNode }) =>
        React.createElement('p', filterProps(props as Record<string, unknown>), children),
      h1: ({ children, ...props }: { children?: React.ReactNode }) =>
        React.createElement('h1', filterProps(props as Record<string, unknown>), children),
      h2: ({ children, ...props }: { children?: React.ReactNode }) =>
        React.createElement('h2', filterProps(props as Record<string, unknown>), children),
      h3: ({ children, ...props }: { children?: React.ReactNode }) =>
        React.createElement('h3', filterProps(props as Record<string, unknown>), children),
      ul: ({ children, ...props }: { children?: React.ReactNode }) =>
        React.createElement('ul', filterProps(props as Record<string, unknown>), children),
      li: ({ children, ...props }: { children?: React.ReactNode }) =>
        React.createElement('li', filterProps(props as Record<string, unknown>), children),
      form: ({ children, ...props }: { children?: React.ReactNode }) =>
        React.createElement('form', filterProps(props as Record<string, unknown>), children),
      label: ({ children, ...props }: { children?: React.ReactNode }) =>
        React.createElement('label', filterProps(props as Record<string, unknown>), children),
      img: ({ ...props }) => React.createElement('img', filterProps(props as Record<string, unknown>)),
      svg: ({ children, ...props }: { children?: React.ReactNode }) =>
        React.createElement('svg', filterProps(props as Record<string, unknown>), children),
      path: ({ ...props }) => React.createElement('path', filterProps(props as Record<string, unknown>)),
    },
    AnimatePresence: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    useReducedMotion: () => false,
  };
});
