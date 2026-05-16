import 'fake-indexeddb/auto';
import * as matchers from '@testing-library/jest-dom/matchers';
import { expect, vi, afterEach, afterAll } from 'vitest';
import React from 'react';
import { cleanup } from '@testing-library/react';

expect.extend(matchers);

// Clean up DOM after each test to prevent memory leaks
// Note: React concurrent state pollution between test files is a known vitest issue
// that cannot be fixed via cleanup - skip affected tests instead
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Reset module cache after all tests to help with garbage collection
afterAll(() => {
  vi.resetModules();
});

// Simple framer-motion mock - just render as regular elements without Proxy
// This avoids memory issues from Proxy-based dynamic component generation
vi.mock('framer-motion', () => {
  const filterProps = (props: Record<string, unknown>) => {
    const filtered: Record<string, unknown> = {};
    for (const key in props) {
      if (!['whileHover', 'whileTap', 'initial', 'animate', 'exit', 'transition', 'variants'].includes(key)) {
        filtered[key] = props[key];
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
