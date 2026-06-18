import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GrantForm } from './GrantForm';

vi.mock('../../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

describe('GrantForm', () => {
  const defaultProps = {
    isOpen: true,
    editingGrant: null,
    formData: {
      email: 'test@example.com',
      password: '',
      passwordConfirm: '',
      mode: 'private',
      commentsAllowed: false,
      offlineAllowed: false,
      expiresAt: '',
    },
    formErrors: {},
    isSubmitting: false,
    onChange: vi.fn(),
    onSubmit: vi.fn(),
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders create form when editingGrant is null', () => {
    render(<GrantForm {...defaultProps} />);
    expect(screen.getByText('grants.createGrantTitle')).toBeInTheDocument();
  });

  it('renders edit form when editingGrant is provided', () => {
    const editingGrant = {
      id: '1',
      email: 'test@example.com',
      mode: 'private',
      commentsAllowed: false,
      offlineAllowed: false,
      expiresAt: null,
    };
    render(<GrantForm {...defaultProps} editingGrant={editingGrant as any} />);
    expect(screen.getByText('grants.editGrantTitle')).toBeInTheDocument();
  });

  it('shows password fields when creating', () => {
    render(<GrantForm {...defaultProps} />);
    expect(screen.getByText('grants.form.password')).toBeInTheDocument();
    expect(screen.getByText('grants.form.passwordConfirm')).toBeInTheDocument();
  });

  it('hides password fields when editing', () => {
    const editingGrant = {
      id: '1',
      email: 'test@example.com',
      mode: 'private',
      commentsAllowed: false,
      offlineAllowed: false,
      expiresAt: null,
    };
    render(<GrantForm {...defaultProps} editingGrant={editingGrant as any} />);
    expect(screen.queryByText('grants.form.password')).not.toBeInTheDocument();
  });

  it('shows mode selector', () => {
    render(<GrantForm {...defaultProps} />);
    expect(screen.getByText('grants.form.mode')).toBeInTheDocument();
  });

  it('shows capability toggles', () => {
    render(<GrantForm {...defaultProps} />);
    expect(screen.getByText('grants.capabilities.comments')).toBeInTheDocument();
    expect(screen.getByText('grants.capabilities.offline')).toBeInTheDocument();
  });

  it('shows expiry date field', () => {
    render(<GrantForm {...defaultProps} />);
    expect(screen.getByText('grants.form.expiry')).toBeInTheDocument();
  });

  it('shows form errors', () => {
    const props = {
      ...defaultProps,
      formErrors: { submit: 'Error occurred' },
    };
    render(<GrantForm {...props} />);
    expect(screen.getByText('Error occurred')).toBeInTheDocument();
  });

  it('calls onChange when email changes', () => {
    render(<GrantForm {...defaultProps} />);
    const emailInput = screen.getByDisplayValue('test@example.com');
    fireEvent.change(emailInput, { target: { value: 'new@example.com' } });
    expect(defaultProps.onChange).toHaveBeenCalled();
  });

  it('calls onChange when mode changes', () => {
    render(<GrantForm {...defaultProps} />);
    const modeSelect = screen.getByDisplayValue('Private');
    fireEvent.change(modeSelect, { target: { value: 'public' } });
    expect(defaultProps.onChange).toHaveBeenCalled();
  });

  it('calls onChange when comments toggle changes', () => {
    render(<GrantForm {...defaultProps} />);
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    expect(defaultProps.onChange).toHaveBeenCalled();
  });

  it('calls onChange when offline toggle changes', () => {
    render(<GrantForm {...defaultProps} />);
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]);
    expect(defaultProps.onChange).toHaveBeenCalled();
  });

  it('calls onChange when expiry date changes', () => {
    render(<GrantForm {...defaultProps} />);
    const dateInput = screen.getAllByRole('textbox')[0];
    fireEvent.change(dateInput, { target: { value: '2025-12-31' } });
    expect(defaultProps.onChange).toHaveBeenCalled();
  });

  it('calls onClose when cancel button clicked', () => {
    render(<GrantForm {...defaultProps} />);
    fireEvent.click(screen.getByText('annotation.cancel'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('calls onSubmit when submit button clicked', () => {
    render(<GrantForm {...defaultProps} />);
    fireEvent.click(screen.getByText('grants.createGrant'));
    expect(defaultProps.onSubmit).toHaveBeenCalled();
  });

  it('shows submitting state', () => {
    const props = {
      ...defaultProps,
      isSubmitting: true,
    };
    render(<GrantForm {...props} />);
    expect(screen.getByText('grants.form.submitting')).toBeInTheDocument();
  });

  it('shows save button when editing', () => {
    const editingGrant = {
      id: '1',
      email: 'test@example.com',
      mode: 'private',
      commentsAllowed: false,
      offlineAllowed: false,
      expiresAt: null,
    };
    render(<GrantForm {...defaultProps} editingGrant={editingGrant as any} />);
    expect(screen.getByText('grants.actions.save')).toBeInTheDocument();
  });
});
