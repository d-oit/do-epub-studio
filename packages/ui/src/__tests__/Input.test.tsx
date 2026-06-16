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

  it('displays helper text when no error', () => {
    render(<Input label="Email" helperText="We'll never share your email" />);
    expect(screen.getByText("We'll never share your email")).toBeInTheDocument();
  });

  it('does not display helper text when error is present', () => {
    render(<Input label="Email" error="Invalid" helperText="Help text" />);
    expect(screen.getByText('Invalid')).toBeInTheDocument();
    expect(screen.queryByText('Help text')).not.toBeInTheDocument();
  });

  it('sets aria-describedby to helper id when helperText provided', () => {
    render(<Input id="test-input" helperText="Helper" />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-describedby', 'test-input-helper');
  });

  it('sets aria-describedby to error id when error provided', () => {
    render(<Input id="test-input" error="Error" />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-describedby', 'test-input-error');
  });
});
