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

    it('anchors the toggle to the leading edge with matching input padding', () => {
      render(<Input id="pw" label="Password" type="password" showPasswordLabel="Show password" hidePasswordLabel="Hide password" />);
      const field = screen.getByLabelText('Password').closest('.pw-field');
      const toggle = screen.getByRole('button', { name: 'Show password' });

      // Geometry + start-edge anchor live in plain CSS (globals.css) because
      // packages/ui utilities are not scanned by the app's Tailwind config.
      expect(field).not.toBeNull();
      expect(toggle).toHaveClass('pw-toggle');
      expect(toggle).not.toHaveClass('right-1');
      // The full label is preserved as the accessible name.
      expect(toggle).toHaveAttribute('aria-label', 'Show password');
    });

    it('toggles input type and label on click', () => {
      render(<Input id="pw" label="Password" type="password" showPasswordLabel="Show password" hidePasswordLabel="Hide password" />);
      const input = screen.getByLabelText('Password');
      const toggle = screen.getByRole('button', { name: 'Show password' });

      fireEvent.click(toggle);
      expect(input).toHaveAttribute('type', 'text');
      // GOV.UK pattern: state is conveyed by the changing accessible name,
      // not aria-expanded/aria-pressed (which would mis-announce a disclosure).
      expect(toggle).not.toHaveAttribute('aria-expanded');
      expect(toggle).not.toHaveAttribute('aria-pressed');
      expect(screen.getByRole('button', { name: 'Hide password' })).toBeInTheDocument();

      fireEvent.click(toggle);
      expect(input).toHaveAttribute('type', 'password');
      expect(screen.getByRole('button', { name: 'Show password' })).toBeInTheDocument();
    });

    it('links the toggle to the input via aria-controls', () => {
      render(<Input id="pw" label="Password" type="password" showPasswordLabel="Show password" hidePasswordLabel="Hide password" />);
      const toggle = screen.getByRole('button', { name: 'Show password' });
      expect(toggle).toHaveAttribute('aria-controls', 'pw');
      expect(screen.getByLabelText('Password')).toHaveAttribute('id', 'pw');
    });

    it('keeps the accessible name when the label text is hidden on small screens', () => {
      // The label renders inside a Tailwind `hidden sm:inline` span (icon-only
      // below sm for long-locale overflow), so the button's accessible name
      // must come from aria-label instead of text content.
      render(<Input id="pw" label="Password" type="password" showPasswordLabel="Show password" hidePasswordLabel="Hide password" />);
      const toggle = screen.getByRole('button', { name: 'Show password' });
      expect(toggle).toHaveAttribute('aria-label', 'Show password');

      fireEvent.click(toggle);
      expect(toggle).toHaveAttribute('aria-label', 'Hide password');
    });
  });
});
