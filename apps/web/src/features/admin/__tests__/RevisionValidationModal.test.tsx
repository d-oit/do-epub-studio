import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RevisionValidationModal } from '../components/RevisionValidationModal';
import {
  fetchRevisionReports,
  fetchRevisionValidationDetail,
} from '../../../lib/api/admin-validation';
import type { BookResponse } from '@do-epub-studio/shared';

vi.mock('../../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock('../../../stores/auth', () => {
  const state = { sessionToken: 'admin-token', refreshSession: vi.fn() };
  const useAuthStore = (selector: (current: typeof state) => unknown) => selector(state);
  useAuthStore.getState = () => state;
  return { useAuthStore };
});

vi.mock('../../../lib/api/admin-validation', () => ({
  fetchRevisionReports: vi.fn(),
  fetchRevisionValidationDetail: vi.fn(),
  retryRevisionValidation: vi.fn(),
  updateRevisionRemediation: vi.fn(),
}));

const mockBook: BookResponse = {
  id: 'book-1',
  title: 'Accessible Computing Guide',
  authorName: 'Alan Turing',
  description: 'A comprehensive guide',
  visibility: 'private',
  slug: 'accessible-computing',
  language: 'en',
  coverImageUrl: null,
  publishedAt: '2026-01-01T00:00:00.000Z',
};

const mockSummaryReports = [
  {
    revisionId: 'rev-1',
    bytesSha256: 'a'.repeat(64),
    validatorVersion: '5.4.0',
    status: 'completed',
    safetyStatus: 'accepted',
    epubVersion: '3.0',
    updatedAt: '2026-11-01T12:00:00.000Z',
  },
];

const mockDetailReport = {
  revisionId: 'rev-1',
  bytesSha256: 'a'.repeat(64),
  validatorVersion: '5.4.0',
  status: 'completed',
  safetyStatus: 'accepted',
  epubVersion: '3.0',
  groups: {
    errors: [
      {
        severity: 'error' as const,
        code: 'RSC-005',
        path: 'OEBPS/ch1.xhtml',
        location: '10:5',
        message: 'Invalid hyperlink reference',
      },
    ],
    warnings: [
      {
        severity: 'warning' as const,
        code: 'ACC-001',
        path: 'OEBPS/ch1.xhtml',
        location: null,
        message: 'Non-standard heading structure',
      },
    ],
    information: [
      {
        severity: 'info' as const,
        code: 'HTM-001',
        path: null,
        location: null,
        message: 'Document encoding UTF-8',
      },
    ],
  },
  accessibility: {
    metadata: [
      { key: 'dc:language', value: 'en-US', provenance: 'opf' },
      { key: 'schema:accessMode', value: 'textual', provenance: 'opf' },
      { key: 'schema:accessibilityFeature', value: 'structuralNavigation', provenance: 'opf' },
    ],
    advisories: [
      {
        category: 'language',
        message: 'Check language declarations',
        source: 'manual-review',
      },
    ],
    manualReviewRequired: true,
    certification: 'not-certified',
  },
  remediation: {
    status: 'in_progress' as const,
    notes: 'Working on resolving RSC-005',
    checklist: { 'headings-checked': true },
  },
  failureCode: null,
  updatedAt: '2026-11-01T12:00:00.000Z',
};

describe('RevisionValidationModal', () => {
  const onRetryWithStepUp = vi.fn();
  const onSaveRemediationWithStepUp = vi.fn();
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <RevisionValidationModal
        isOpen={false}
        onClose={onClose}
        book={mockBook}
        onRetryWithStepUp={onRetryWithStepUp}
        onSaveRemediationWithStepUp={onSaveRemediationWithStepUp}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('fetches and displays revision details and grouped findings when open', async () => {
    vi.mocked(fetchRevisionReports).mockResolvedValue(mockSummaryReports);
    vi.mocked(fetchRevisionValidationDetail).mockResolvedValue(mockDetailReport);

    render(
      <RevisionValidationModal
        isOpen={true}
        onClose={onClose}
        book={mockBook}
        onRetryWithStepUp={onRetryWithStepUp}
        onSaveRemediationWithStepUp={onSaveRemediationWithStepUp}
      />,
    );

    expect(screen.getByText('admin.validation.title')).toBeInTheDocument();
    expect(screen.getByText('Accessible Computing Guide')).toBeInTheDocument();

    await waitFor(() => {
      expect(fetchRevisionReports).toHaveBeenCalledWith('book-1', 'admin-token');
      expect(fetchRevisionValidationDetail).toHaveBeenCalledWith('book-1', 'rev-1', 'admin-token');
    });

    await waitFor(() => {
      expect(screen.getByText('RSC-005')).toBeInTheDocument();
      expect(screen.getByText('OEBPS/ch1.xhtml (10:5)')).toBeInTheDocument();
      expect(screen.getByText('Invalid hyperlink reference')).toBeInTheDocument();
      expect(screen.getByText('ACC-001')).toBeInTheDocument();
      expect(screen.getByText('HTM-001')).toBeInTheDocument();
    });
  });

  it('displays accessibility tab with metadata and non-certification notice', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchRevisionReports).mockResolvedValue(mockSummaryReports);
    vi.mocked(fetchRevisionValidationDetail).mockResolvedValue(mockDetailReport);

    render(
      <RevisionValidationModal
        isOpen={true}
        onClose={onClose}
        book={mockBook}
        onRetryWithStepUp={onRetryWithStepUp}
        onSaveRemediationWithStepUp={onSaveRemediationWithStepUp}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('RSC-005')).toBeInTheDocument();
    });

    const a11yTab = screen.getByRole('tab', { name: 'admin.validation.accessibilityTab' });
    await user.click(a11yTab);

    expect(screen.getByText('admin.validation.accessibilityNotice')).toBeInTheDocument();
    expect(screen.getByText('admin.validation.manualReviewRequired')).toBeInTheDocument();
    expect(screen.getByText('dc:language')).toBeInTheDocument();
    expect(screen.getByText('en-US')).toBeInTheDocument();
    expect(screen.getByText('structuralNavigation')).toBeInTheDocument();
    expect(screen.getByText('Check language declarations')).toBeInTheDocument();
  });

  it('displays remediation editor and saves changes with step-up', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchRevisionReports).mockResolvedValue(mockSummaryReports);
    vi.mocked(fetchRevisionValidationDetail).mockResolvedValue(mockDetailReport);
    onSaveRemediationWithStepUp.mockResolvedValue(undefined);

    render(
      <RevisionValidationModal
        isOpen={true}
        onClose={onClose}
        book={mockBook}
        onRetryWithStepUp={onRetryWithStepUp}
        onSaveRemediationWithStepUp={onSaveRemediationWithStepUp}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('RSC-005')).toBeInTheDocument();
    });

    const remediationTab = screen.getByRole('tab', { name: 'admin.validation.remediationTab' });
    await user.click(remediationTab);

    const notesTextarea = screen.getByLabelText('admin.validation.remediationNotes');
    expect(notesTextarea).toHaveValue('Working on resolving RSC-005');

    await user.clear(notesTextarea);
    await user.type(notesTextarea, 'All findings resolved.');

    const saveBtn = screen.getByRole('button', { name: 'admin.validation.saveRemediation' });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(onSaveRemediationWithStepUp).toHaveBeenCalledWith(
        'book-1',
        'rev-1',
        expect.objectContaining({
          status: 'in_progress',
          notes: 'All findings resolved.',
        }),
      );
    });
  });

  it('calls onRetryWithStepUp when retry button is clicked', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchRevisionReports).mockResolvedValue(mockSummaryReports);
    vi.mocked(fetchRevisionValidationDetail).mockResolvedValue(mockDetailReport);
    onRetryWithStepUp.mockResolvedValue(undefined);

    render(
      <RevisionValidationModal
        isOpen={true}
        onClose={onClose}
        book={mockBook}
        onRetryWithStepUp={onRetryWithStepUp}
        onSaveRemediationWithStepUp={onSaveRemediationWithStepUp}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('RSC-005')).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole('button', { name: 'admin.validation.retryValidation' });
    await user.click(retryBtn);

    expect(onRetryWithStepUp).toHaveBeenCalledWith('book-1', 'rev-1');
  });

  it('handles report download', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchRevisionReports).mockResolvedValue(mockSummaryReports);
    vi.mocked(fetchRevisionValidationDetail).mockResolvedValue(mockDetailReport);

    const mockBlob = new Blob(['{}'], { type: 'application/json' });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(mockBlob),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <RevisionValidationModal
        isOpen={true}
        onClose={onClose}
        book={mockBook}
        onRetryWithStepUp={onRetryWithStepUp}
        onSaveRemediationWithStepUp={onSaveRemediationWithStepUp}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('RSC-005')).toBeInTheDocument();
    });

    const downloadBtn = screen.getByRole('button', { name: 'admin.validation.downloadReport' });
    await user.click(downloadBtn);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/books/book-1/revisions/rev-1/validation.json',
      expect.objectContaining({
        headers: { Authorization: 'Bearer admin-token' },
      }),
    );

    vi.unstubAllGlobals();
  });

  it('closes on cancel button click', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchRevisionReports).mockResolvedValue(mockSummaryReports);
    vi.mocked(fetchRevisionValidationDetail).mockResolvedValue(mockDetailReport);

    render(
      <RevisionValidationModal
        isOpen={true}
        onClose={onClose}
        book={mockBook}
        onRetryWithStepUp={onRetryWithStepUp}
        onSaveRemediationWithStepUp={onSaveRemediationWithStepUp}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('RSC-005')).toBeInTheDocument();
    });

    const cancelButtons = screen.getAllByRole('button', { name: 'annotation.cancel' });
    const targetBtn = cancelButtons[0];
    if (targetBtn) await user.click(targetBtn);
    expect(onClose).toHaveBeenCalled();
  });
});
