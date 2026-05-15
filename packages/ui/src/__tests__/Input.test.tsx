import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Input } from '../input';

describe('Input', () => {
  it('renders with label', () => {
    render(<Input label="Email" />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('renders with placeholder', () => {
    render(<Input placeholder="Enter text" />);
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
  });

  it('displays value and calls onChange', () => {
    const onChange = vi.fn();
    render(<Input value="hello" onChange={onChange} />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('hello');
    fireEvent.change(input, { target: { value: 'world' } });
    expect(onChange).toHaveBeenCalled();
  });

  it('renders disabled state', () => {
    render(<Input label="Disabled" disabled />);
    expect(screen.getByLabelText('Disabled')).toBeDisabled();
  });

  it('displays error message and sets aria-invalid', () => {
    render(<Input label="Name" error="Required" />);
    expect(screen.getByText('Required')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true');
  });
});
