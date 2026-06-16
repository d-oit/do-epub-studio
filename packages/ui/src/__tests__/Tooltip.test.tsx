import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Tooltip } from '../tooltip';

describe('Tooltip', () => {
  it('renders children', () => {
    render(<Tooltip content="Help text"><button>Click me</button></Tooltip>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('does not show tooltip initially', () => {
    render(<Tooltip content="Help text"><button>Click me</button></Tooltip>);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('shows tooltip on mouse enter', () => {
    render(<Tooltip content="Help text"><button>Click me</button></Tooltip>);
    const wrapper = screen.getByText('Click me').parentElement;
    if (wrapper) fireEvent.mouseEnter(wrapper);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Help text');
  });

  it('hides tooltip on mouse leave', () => {
    render(<Tooltip content="Help text"><button>Click me</button></Tooltip>);
    const wrapper = screen.getByText('Click me').parentElement;
    if (wrapper) {
      fireEvent.mouseEnter(wrapper);
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
      fireEvent.mouseLeave(wrapper);
    }
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('shows tooltip on focus', () => {
    render(<Tooltip content="Help text"><button>Click me</button></Tooltip>);
    fireEvent.focus(screen.getByText('Click me'));
    expect(screen.getByRole('tooltip')).toHaveTextContent('Help text');
  });

  it('hides tooltip on blur', () => {
    render(<Tooltip content="Help text"><button>Click me</button></Tooltip>);
    fireEvent.focus(screen.getByText('Click me'));
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.blur(screen.getByText('Click me'));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('sets aria-describedby when visible', () => {
    render(<Tooltip content="Help text"><button>Click me</button></Tooltip>);
    const wrapper = screen.getByText('Click me').parentElement;
    if (wrapper) fireEvent.mouseEnter(wrapper);
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toHaveAttribute('id');
    const span = screen.getByText('Click me').closest('span');
    expect(span).toHaveAttribute('aria-describedby', tooltip.id);
  });

  it('removes aria-describedby when hidden', () => {
    render(<Tooltip content="Help text"><button>Click me</button></Tooltip>);
    expect(screen.getByText('Click me')).not.toHaveAttribute('aria-describedby');
  });

  it('renders with string children', () => {
    render(<Tooltip content="Help">Plain text</Tooltip>);
    expect(screen.getByText('Plain text')).toBeInTheDocument();
  });

  it('shows tooltip with string children on hover', () => {
    render(<Tooltip content="Help">Plain text</Tooltip>);
    const wrapper = screen.getByText('Plain text').parentElement;
    if (wrapper) fireEvent.mouseEnter(wrapper);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Help');
  });
});
