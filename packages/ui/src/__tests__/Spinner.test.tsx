import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Spinner } from '../spinner';

describe('Spinner', () => {
  it('renders with status role', () => {
    render(<Spinner />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders default label text', () => {
    render(<Spinner />);
    expect(screen.getByText('Loading')).toBeInTheDocument();
  });

  it('renders custom label', () => {
    render(<Spinner label="Saving" />);
    expect(screen.getByText('Saving')).toBeInTheDocument();
  });

  it('renders different size variants', () => {
    const { rerender } = render(<Spinner size="sm" />);
    const svg = screen.getByRole('status').querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg?.getAttribute('class')).toContain('w-4');

    rerender(<Spinner size="lg" />);
    const svgLg = screen.getByRole('status').querySelector('svg');
    expect(svgLg?.getAttribute('class')).toContain('w-12');
  });
});
