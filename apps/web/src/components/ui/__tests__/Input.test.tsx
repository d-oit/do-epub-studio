import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Input } from '../index';

// We rely on the global framer-motion mock in test-setup.ts
// but we need to customize it to inspect props for this specific test
// By re-mocking it here, we override the global one
vi.mock('framer-motion', () => ({
  motion: {
    input: React.forwardRef<HTMLInputElement, any>((props, ref) => {
      const {
        whileFocus,
        whileHover: _whileHover,
        whileTap: _whileTap,
        whileDrag: _whileDrag,
        whileInView: _whileInView,
        initial: _initial,
        animate: _animate,
        exit: _exit,
        transition: _transition,
        ...domProps
      } = props;
      return <input {...domProps} ref={ref} data-while-focus={JSON.stringify(whileFocus)} />;
    }),
    div: React.forwardRef<HTMLDivElement, any>(({ children, ...props }, ref) => (
      <div {...props} ref={ref}>{children}</div>
    )),
    p: React.forwardRef<HTMLParagraphElement, any>(({ children, ...props }, ref) => (
      <p {...props} ref={ref}>{children}</p>
    )),
    label: React.forwardRef<HTMLLabelElement, any>(({ children, ...props }, ref) => (
      <label {...props} ref={ref}>{children}</label>
    )),
  },
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => (
    <React.Fragment>{children}</React.Fragment>
  ),
}));

describe('Input', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders correctly with label', () => {
    render(<Input label="Username" placeholder="Enter username" />);
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter username')).toBeInTheDocument();
  });

  it('displays error message when error prop is provided', () => {
    render(<Input label="Email" error="Invalid email address" />);
    expect(screen.getByText('Invalid email address')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
  });

  it('does not have whileFocus scale animation', () => {
    render(<Input label="Test Scale" />);
    const input = screen.getByLabelText('Test Scale');
    const whileFocus = input.getAttribute('data-while-focus');
    expect(whileFocus).toBeNull();
  });

  it('has correct focus ring classes', () => {
    render(<Input label="Test Ring" />);
    const input = screen.getByLabelText('Test Ring');
    expect(input.className).toContain('focus:ring-[3px]');
    expect(input.className).toContain('focus:ring-accent/15');
  });

  it('has correct focus ring classes in error state', () => {
    render(<Input label="Test Error" error="Error" />);
    const input = screen.getByLabelText('Test Error');
    expect(input.className).toContain('focus:ring-accent-error/15');
  });
});
