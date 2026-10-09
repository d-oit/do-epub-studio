import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProgressBar } from '../progress-bar';

describe('ProgressBar', () => {
  it('renders with aria-valuenow', () => {
    render(<ProgressBar value={50} label="Loading" />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '50');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
  });

  it('clamps value between 0 and max', () => {
    const { rerender } = render(<ProgressBar value={-10} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '0');
    rerender(<ProgressBar value={200} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
    rerender(<ProgressBar value={150} max={200} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '150');
  });

  it('shows label when provided', () => {
    render(<ProgressBar value={50} label="Upload progress" />);
    expect(screen.getByText('Upload progress')).toBeInTheDocument();
  });

  it('shows percentage and sets aria-valuetext when showValue is true', () => {
    render(<ProgressBar value={75} showValue label="Progress" />);
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', '75%');
  });

  it('uses custom ariaValueText when provided', () => {
    render(<ProgressBar value={2} max={10} ariaValueText="2 of 10 items completed" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuetext',
      '2 of 10 items completed',
    );
  });
});
