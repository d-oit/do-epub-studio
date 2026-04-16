import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AdminAuditPage } from './AuditLogPage';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock('../../lib/api', () => ({
  apiRequest: vi.fn(),
}));

vi.mock('../../stores/auth', () => ({
  useAuthStore: () => ({
    sessionToken: 'token',
    isAdmin: true,
    logout: vi.fn(),
  }),
}));

import { apiRequest } from '../../lib/api';

describe.skip('AdminAuditPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders audit entries', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      entries: [{ id: '1', actorEmail: 'a@ex.com', entityType: 'book', action: 'create', createdAt: new Date().toISOString() }],
      total: 1
    });

    render(<MemoryRouter><AdminAuditPage /></MemoryRouter>);
    expect(await screen.findByText('a@ex.com')).toBeInTheDocument();
  });
});
