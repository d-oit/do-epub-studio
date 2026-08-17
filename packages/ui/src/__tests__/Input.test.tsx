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

  describe('password visibility toggle', () => {
    it('does not render toggle when labels are not provided', () => {
      render(<Input id="pw" label="Password" type="password" />);
      expect(screen.queryByRole('button', { name: /password/i })).not.toBeInTheDocument();
      expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
    });

    it('renders icon + text toggle when labels are provided', () => {
      render(<Input id="pw" label="Password" type="password" showPasswordLabel="Show password" hidePasswordLabel="Hide password" />);
      const toggle = screen.getByRole('button', { name: 'Show password' });
      expect(toggle).toBeInTheDocument();
      // Decorative eye icon is present but hidden from assistive tech.
      expect(toggle.querySelector('svg[aria-hidden="true"]')).toBeInTheDocument();
      expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
    });

    it('toggles input type and label on click', () => {
      render(<Input id="pw" label="Password" type="password" showPasswordLabel="Show password" hidePasswordLabel="Hide password" />);
      const input = screen.getByLabelText('Password');
      const toggle = screen.getByRole('button', { name: 'Show password' });

      fireEvent.click(toggle);
      expect(input).toHaveAttribute('type', 'text');
      expect(toggle).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByRole('button', { name: 'Hide password' })).toBeInTheDocument();

      fireEvent.click(toggle);
      expect(input).toHaveAttribute('type', 'password');
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
    });

    it('links the toggle to the input via aria-controls', () => {
      render(<Input id="pw" label="Password" type="password" showPasswordLabel="Show password" hidePasswordLabel="Hide password" />);
      const toggle = screen.getByRole('button', { name: 'Show password' });
      expect(toggle).toHaveAttribute('aria-controls', 'pw');
      expect(screen.getByLabelText('Password')).toHaveAttribute('id', 'pw');
    });
  });
});
