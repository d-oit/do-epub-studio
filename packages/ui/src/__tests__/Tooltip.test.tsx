import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Tooltip } from '../tooltip';

describe('Tooltip', () => {
  it('renders children', () => {
    render(<Tooltip content="tooltip text">Hover me</Tooltip>);
    expect(screen.getByText('Hover me')).toBeInTheDocument();
  });

  it('shows tooltip on mouse enter', () => {
    render(<Tooltip content="helpful text"><span>target</span></Tooltip>);
    fireEvent.mouseEnter(screen.getByText('target'));
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveTextContent('helpful text');
  });
});
