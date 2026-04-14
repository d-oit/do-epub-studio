import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { vi, afterEach } from 'vitest';
import React from 'react';
import { cleanup } from '@testing-library/react';

// Clean up DOM after each test to prevent memory leaks
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Mock framer-motion to avoid animation complexity in tests
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual('framer-motion');
  return {
    ...actual,
    motion: {
      div: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) =>
        React.createElement('div', props as Record<string, unknown>, children),
      span: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) =>
        React.createElement('span', props as Record<string, unknown>, children),
      button: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) =>
        React.createElement('button', props as Record<string, unknown>, children),
      header: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) =>
        React.createElement('header', props as Record<string, unknown>, children),
      section: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) =>
        React.createElement('section', props as Record<string, unknown>, children),
      nav: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) =>
        React.createElement('nav', props as Record<string, unknown>, children),
      a: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) =>
        React.createElement('a', props as Record<string, unknown>, children),
      p: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) =>
        React.createElement('p', props as Record<string, unknown>, children),
      h1: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) =>
        React.createElement('h1', props as Record<string, unknown>, children),
      h2: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) =>
        React.createElement('h2', props as Record<string, unknown>, children),
      h3: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) =>
        React.createElement('h3', props as Record<string, unknown>, children),
      ul: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) =>
        React.createElement('ul', props as Record<string, unknown>, children),
      li: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) =>
        React.createElement('li', props as Record<string, unknown>, children),
      form: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) =>
        React.createElement('form', props as Record<string, unknown>, children),
      input: (props: { [key: string]: unknown }) => React.createElement('input', props),
      label: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) =>
        React.createElement('label', props as Record<string, unknown>, children),
      img: (props: { [key: string]: unknown }) => React.createElement('img', props),
      article: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) =>
        React.createElement('article', props as Record<string, unknown>, children),
      aside: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) =>
        React.createElement('aside', props as Record<string, unknown>, children),
      footer: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) =>
        React.createElement('footer', props as Record<string, unknown>, children),
      main: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) =>
        React.createElement('main', props as Record<string, unknown>, children),
      dialog: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) =>
        React.createElement('dialog', props as Record<string, unknown>, children),
    },
    AnimatePresence: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});
