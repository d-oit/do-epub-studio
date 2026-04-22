import 'fake-indexeddb/auto';
import { expect, vi, afterEach, afterAll } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
import React from 'react';
import { cleanup } from '@testing-library/react';

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

// Clean up DOM after each test to prevent memory leaks
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Reset module cache after all tests to help with garbage collection
afterAll(() => {
  vi.resetModules();
});

// Simple framer-motion mock
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: { children?: React.ReactNode }) =>
      React.createElement('div', props, children),
    span: ({ children, ...props }: { children?: React.ReactNode }) =>
      React.createElement('span', props, children),
    button: ({ children, ...props }: { children?: React.ReactNode }) =>
      React.createElement('button', props, children),
    input: ({ ...props }) => React.createElement('input', props),
    header: ({ children, ...props }: { children?: React.ReactNode }) =>
      React.createElement('header', props, children),
    section: ({ children, ...props }: { children?: React.ReactNode }) =>
      React.createElement('section', props, children),
    nav: ({ children, ...props }: { children?: React.ReactNode }) =>
      React.createElement('nav', props, children),
    a: ({ children, ...props }: { children?: React.ReactNode }) =>
      React.createElement('a', props, children),
    p: ({ children, ...props }: { children?: React.ReactNode }) =>
      React.createElement('p', props, children),
    h1: ({ children, ...props }: { children?: React.ReactNode }) =>
      React.createElement('h1', props, children),
    h2: ({ children, ...props }: { children?: React.ReactNode }) =>
      React.createElement('h2', props, children),
    h3: ({ children, ...props }: { children?: React.ReactNode }) =>
      React.createElement('h3', props, children),
    ul: ({ children, ...props }: { children?: React.ReactNode }) =>
      React.createElement('ul', props, children),
    li: ({ children, ...props }: { children?: React.ReactNode }) =>
      React.createElement('li', props, children),
    form: ({ children, ...props }: { children?: React.ReactNode }) =>
      React.createElement('form', props, children),
    label: ({ children, ...props }: { children?: React.ReactNode }) =>
      React.createElement('label', props, children),
    img: ({ ...props }) => React.createElement('img', props),
    svg: ({ children, ...props }: { children?: React.ReactNode }) =>
      React.createElement('svg', props, children),
    path: ({ ...props }) => React.createElement('path', props),
  },
  AnimatePresence: ({ children }: { children?: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));
