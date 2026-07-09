import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Input } from '../index';

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
