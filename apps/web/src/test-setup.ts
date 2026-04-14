import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { vi, afterEach, afterAll } from 'vitest';
import React from 'react';
import { cleanup } from '@testing-library/react';

// Clean up DOM after each test to prevent memory leaks
// clearAllMocks clears call history without removing mock implementations
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Reset module cache after all tests to help with garbage collection
afterAll(() => {
  vi.resetModules();
});

// Mock framer-motion to avoid animation complexity in tests
// Filter out motion-specific props to prevent React warnings
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual('framer-motion');

  // Helper to filter out motion-specific props
  const filterMotionProps = (props: Record<string, unknown>) => {
    const motionProps = ['whileTap', 'whileHover', 'whileFocus', 'whileDrag', 'whileInView',
      'initial', 'animate', 'exit', 'transition', 'variants', 'layout', 'drag'];
    const filtered = { ...props };
    motionProps.forEach(prop => delete filtered[prop]);
    return filtered;
  };

  return {
    ...actual,
    motion: {
      div: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) =>
        React.createElement('div', filterMotionProps(props as Record<string, unknown>), children),
      span: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) =>
        React.createElement('span', filterMotionProps(props as Record<string, unknown>), children),
      button: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) =>
        React.createElement('button', filterMotionProps(props as Record<string, unknown>), children),
      header: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) =>
        React.createElement('header', filterMotionProps(props as Record<string, unknown>), children),
      section: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) =>
        React.createElement('section', filterMotionProps(props as Record<string, unknown>), children),
      nav: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) =>
        React.createElement('nav', filterMotionProps(props as Record<string, unknown>), children),
      a: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) =>
        React.createElement('a', filterMotionProps(props as Record<string, unknown>), children),
      p: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) =>
        React.createElement('p', filterMotionProps(props as Record<string, unknown>), children),
      h1: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) =>
        React.createElement('h1', filterMotionProps(props as Record<string, unknown>), children),
      h2: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) =>
        React.createElement('h2', filterMotionProps(props as Record<string, unknown>), children),
      h3: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) =>
        React.createElement('h3', filterMotionProps(props as Record<string, unknown>), children),
      ul: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) =>
        React.createElement('ul', filterMotionProps(props as Record<string, unknown>), children),
      li: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) =>
        React.createElement('li', filterMotionProps(props as Record<string, unknown>), children),
      form: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) =>
        React.createElement('form', filterMotionProps(props as Record<string, unknown>), children),
      input: (props: { [key: string]: unknown }) =>
        React.createElement('input', filterMotionProps(props)),
      label: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) =>
        React.createElement('label', filterMotionProps(props as Record<string, unknown>), children),
      img: (props: { [key: string]: unknown }) =>
        React.createElement('img', filterMotionProps(props)),
      article: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) =>
        React.createElement('article', filterMotionProps(props as Record<string, unknown>), children),
      aside: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) =>
        React.createElement('aside', filterMotionProps(props as Record<string, unknown>), children),
      footer: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) =>
        React.createElement('footer', filterMotionProps(props as Record<string, unknown>), children),
      main: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) =>
        React.createElement('main', filterMotionProps(props as Record<string, unknown>), children),
      dialog: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) =>
        React.createElement('dialog', filterMotionProps(props as Record<string, unknown>), children),
    },
    AnimatePresence: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});
