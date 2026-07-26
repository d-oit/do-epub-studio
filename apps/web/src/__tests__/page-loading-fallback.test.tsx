import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageLoadingFallback } from '../components/PageLoadingFallback';

describe('PageLoadingFallback', () => {
  it('renders with default label', () => {
    render(<PageLoadingFallback />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Loading…');
  });

  it('renders with custom label', () => {
    render(<PageLoadingFallback label="Please wait" />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Please wait');
  });

  it('has aria-live polite', () => {
    render(<PageLoadingFallback />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });

  it('contains sr-only screen reader text', () => {
    render(<PageLoadingFallback />);
    const srOnly = screen.getByText('Loading…');
    expect(srOnly).toHaveClass('sr-only');
  });

  it('applies custom minHeight', () => {
    render(<PageLoadingFallback minHeight="min-h-[40vh]" />);
    const container = screen.getByRole('status');
    expect(container).toHaveClass('min-h-[40vh]');
  });

  it('uses default minHeight when not provided', () => {
    render(<PageLoadingFallback />);
    const container = screen.getByRole('status');
    expect(container).toHaveClass('min-h-[60vh]');
  });

  it('renders animated pulse elements', () => {
    const { container } = render(<PageLoadingFallback />);
    const pulseElements = container.querySelectorAll('.animate-pulse');
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  it('has aria-hidden on decorative elements', () => {
    const { container } = render(<PageLoadingFallback />);
    const hiddenElements = container.querySelectorAll('[aria-hidden="true"]');
    expect(hiddenElements.length).toBeGreaterThan(0);
  });
});
