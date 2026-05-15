import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';
import React from 'react';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: { children?: React.ReactNode }) =>
      React.createElement('div', props, children),
    span: ({ children, ...props }: { children?: React.ReactNode }) =>
      React.createElement('span', props, children),
    button: ({ children, ...props }: { children?: React.ReactNode }) =>
      React.createElement('button', props, children),
    input: ({ ...props }: Record<string, unknown>) => React.createElement('input', props),
    p: ({ children, ...props }: { children?: React.ReactNode }) =>
      React.createElement('p', props, children),
    h2: ({ children, ...props }: { children?: React.ReactNode }) =>
      React.createElement('h2', props, children),
    svg: ({ children, ...props }: { children?: React.ReactNode }) =>
      React.createElement('svg', props, children),
    path: (props: Record<string, unknown>) => React.createElement('path', props),
    circle: (props: Record<string, unknown>) => React.createElement('circle', props),
  },
  AnimatePresence: ({ children }: { children?: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));
