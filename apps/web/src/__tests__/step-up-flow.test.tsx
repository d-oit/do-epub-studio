/* biome-ignore-all lint/correctness/useQwikValidLexicalScope: this project uses React, not Qwik */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAdminStepUp, performStepUp } from '../features/admin/step-up';
import { apiRequest } from '../lib/api';

vi.mock('../lib/api', () => ({
  apiRequest: vi.fn(),
}));

const mockRefreshSession = vi.fn();
vi.mock('../stores/auth', () => ({
  useAuthStore: {
    getState: () => ({ sessionToken: 'old-token', refreshSession: mockRefreshSession }),
  },
}));

vi.mock('../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../components/ui', () => ({
  Modal: ({
    isOpen,
    children,
    footer,
  }: {
    isOpen: boolean;
    children?: React.ReactNode;
    footer?: React.ReactNode;
  }) =>
    isOpen ? (
      <div role="dialog">
        {children}
        {footer}
      </div>
    ) : null,
  Button: ({
    children,
    onClick,
    isLoading,
    loadingLabel,
    disabled,
    type,
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
    isLoading?: boolean;
    loadingLabel?: string;
    disabled?: boolean;
    type?: 'reset' | 'submit' | 'button';
  }) => (
    <button type={type || 'button'} onClick={onClick} disabled={disabled || isLoading}>
      {isLoading ? loadingLabel || 'Loading...' : children}
    </button>
  ),
  Input: ({
    label,
    id,
    ...props
  }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) => (
    <div>
      {label && <label htmlFor={id}>{label}</label>}
      <input id={id} {...props} />
    </div>
  ),
}));

function Harness() {
  const { execute, modal } = useAdminStepUp();
  const [result, setResult] = useState<string>('');

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          execute((tok) => apiRequest('/api/guarded', { token: tok }))
            .then(() => setResult('ok'))
            .catch((err: Error) => setResult(err.message));
        }}
      >
        run
      </button>
      <span data-testid="result">{result}</span>
      {modal}
    </div>
  );
}

function stepUpError(): Error {
  const err = new Error('Step-up authentication required');
  (err as Error & { code?: string; status?: number }).code = 'STEP_UP_REQUIRED';
  (err as Error & { code?: string; status?: number }).status = 428;
  return err;
}

describe('useAdminStepUp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRefreshSession.mockClear();
  });

  it('runs a guarded mutation directly when no step-up is required', async () => {
    const user = userEvent.setup();
    const mockApiRequest = vi.mocked(apiRequest);
    mockApiRequest.mockResolvedValue({ ok: true });

    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'run' }));

    await waitFor(() => {
      expect(screen.getByTestId('result')).toHaveTextContent('ok');
    });
    expect(mockApiRequest).toHaveBeenCalledTimes(1);
    expect(mockApiRequest).toHaveBeenCalledWith('/api/guarded', { token: 'old-token' });
    expect(mockRefreshSession).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('triggers step-up on 428, stores the rotated token, and retries', async () => {
    const user = userEvent.setup();
    const mockApiRequest = vi.mocked(apiRequest);
    let guardedCalls = 0;
    mockApiRequest.mockImplementation((endpoint: string) => {
      if (endpoint === '/api/admin/account/step-up') {
        return Promise.resolve({ token: 'rotated-token' });
      }
      if (endpoint === '/api/guarded') {
        guardedCalls += 1;
        return guardedCalls === 1 ? Promise.reject(stepUpError()) : Promise.resolve({ ok: true });
      }
      return Promise.resolve({ ok: true });
    });

    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'run' }));

    // Step-up modal appears
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText('admin.stepUp.currentPassword'), 'mypassword');
    await user.click(screen.getByRole('button', { name: 'admin.stepUp.confirm' }));

    await waitFor(() => {
      expect(screen.getByTestId('result')).toHaveTextContent('ok');
    });

    // Step-up called with current token + password
    expect(mockApiRequest).toHaveBeenCalledWith('/api/admin/account/step-up', {
      method: 'POST',
      token: 'old-token',
      body: JSON.stringify({ currentPassword: 'mypassword' }),
    });

    // Rotated token stored
    expect(mockRefreshSession).toHaveBeenCalledWith({ sessionToken: 'rotated-token' });

    // Mutation retried once with the rotated token
    expect(guardedCalls).toBe(2);
    expect(mockApiRequest).toHaveBeenLastCalledWith('/api/guarded', { token: 'rotated-token' });
  });

  it('shows an error and keeps the modal open when step-up fails', async () => {
    const user = userEvent.setup();
    const mockApiRequest = vi.mocked(apiRequest);
    mockApiRequest.mockImplementation((endpoint: string) => {
      if (endpoint === '/api/admin/account/step-up') {
        return Promise.reject(new Error('bad password'));
      }
      return Promise.reject(stepUpError());
    });

    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'run' }));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText('admin.stepUp.currentPassword'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'admin.stepUp.confirm' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('bad password');
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('rejects the pending mutation when the user cancels', async () => {
    const user = userEvent.setup();
    const mockApiRequest = vi.mocked(apiRequest);
    mockApiRequest.mockRejectedValue(stepUpError());

    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'run' }));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'admin.stepUp.cancel' }));

    await waitFor(() => {
      expect(screen.getByTestId('result')).toHaveTextContent('cancelled');
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('performStepUp replaces the stored token', async () => {
    const mockApiRequest = vi.mocked(apiRequest);
    mockApiRequest.mockResolvedValue({ token: 'rotated-token' });

    const newToken = await performStepUp('mypassword');

    expect(newToken).toBe('rotated-token');
    expect(mockRefreshSession).toHaveBeenCalledWith({ sessionToken: 'rotated-token' });
  });
});
