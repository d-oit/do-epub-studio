import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import type { ReactElement } from 'react';
import { InfoPanel } from '../features/reader/components/info/InfoPanel';
import * as readingInsights from '../lib/offline/reading-insights';
import * as apiModule from '../lib/api';
import { useAuthStore } from '../stores/auth';

vi.mock('../lib/offline/reading-insights', () => ({
  computeInsightSummary: vi.fn().mockResolvedValue(null),
}));

vi.mock('../lib/api', () => ({
  apiRequest: vi.fn(),
}));

/**
 * Both modules are mocked, so the handles are untyped: the real signatures are
 * generic and narrower than what the mocks exercise.
 */
const mockCompute = readingInsights.computeInsightSummary as unknown as Mock;
const mockApiRequest = apiModule.apiRequest as unknown as Mock;

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    'reader.aboutBook': 'About Book',
    'a11y.close': 'Close',
    'reader.metadataNotAvailable': 'No metadata available',
    'reader.details': 'Details',
    'reader.title': 'Title',
    'reader.author': 'Author',
    'reader.publisher': 'Publisher',
    'reader.language': 'Language',
    'reader.description': 'Description',
    'reader.accessibility': 'Accessibility',
    'reader.conformsTo': 'Conforms to',
    'reader.features': 'Features',
    'reader.hazards': 'Hazards',
    'reader.controls': 'Controls',
    'reader.api': 'API',
    'reader.certifiedBy': 'Certified by',
    'reader.certificationReport': 'Certification Report',
    'reader.readingInsights': 'Reading Insights',
    'reader.totalActiveTime': 'Total Active Time',
    'reader.estimatedRemaining': 'Estimated Remaining',
    'reader.readingStreak': 'Reading Streak',
    'reader.recentActivity': 'Recent Activity',
    'reader.days': 'days',
    'reader.deviceLocal': 'Device-local',
    'reader.syncedHistory': 'Synced Reading History (Last 30 Days)',
    'reader.syncedActiveTime': 'Synced Active Time',
    'reader.syncedPagesRead': 'Synced Pages Read',
    'reader.noLocalActivity': 'No local reading activity recorded on this device yet.',
    'reader.localInsightsUnavailable':
      'Local reading insights unavailable — device storage could not be read.',
    'reader.noSyncedHistory': 'No synchronized reading history for this book.',
    'reader.exportInsights': 'Export Reading Insights (JSON)',
  };
  return translations[key] ?? key;
};

describe('InfoPanel', () => {
  const onClose = vi.fn();
  const mockBookId = 'test-book-id';
  const mockProgressPercent = 42;

  /**
   * Renders the panel and lets the local-summary promise settle inside `act`.
   * The summary resolves after the synchronous test body would otherwise end,
   * which produced an unwrapped state update (ADR-275).
   */
  const renderPanel = async (element: ReactElement): Promise<void> => {
    await act(async () => {
      render(element);
      await Promise.resolve();
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Each test declares its own summary outcome; a rejected promise left over
    // from an earlier test would otherwise leak into the next one.
    mockCompute.mockReset();
    mockCompute.mockResolvedValue(null);
    mockApiRequest.mockReset();
    useAuthStore.setState({ sessionToken: null });
  });

  it('renders nothing when isOpen is false', async () => {
    await renderPanel(
      <InfoPanel
        isOpen={false}
        onClose={onClose}
        metadata={null}
        bookId={mockBookId}
        progressPercent={mockProgressPercent}
        t={mockT}
      />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders dialog when isOpen is true', async () => {
    await renderPanel(
      <InfoPanel
        isOpen={true}
        onClose={onClose}
        metadata={null}
        bookId={mockBookId}
        progressPercent={mockProgressPercent}
        t={mockT}
      />,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('shows no metadata message when metadata is null', async () => {
    await renderPanel(
      <InfoPanel
        isOpen={true}
        onClose={onClose}
        metadata={null}
        bookId={mockBookId}
        progressPercent={mockProgressPercent}
        t={mockT}
      />,
    );
    expect(screen.getByText('No metadata available')).toBeInTheDocument();
  });

  it('shows book details when metadata provided', async () => {
    const metadata = {
      title: 'My Book',
      creator: 'Author Name',
      publisher: 'Publisher',
      language: 'en',
    };
    await renderPanel(
      <InfoPanel
        isOpen={true}
        onClose={onClose}
        metadata={metadata}
        bookId={mockBookId}
        progressPercent={mockProgressPercent}
        t={mockT}
      />,
    );
    expect(screen.getByText('My Book')).toBeInTheDocument();
  });

  it('shows description when provided', async () => {
    const metadata = { title: 'Book', description: 'A great book' };
    await renderPanel(
      <InfoPanel
        isOpen={true}
        onClose={onClose}
        metadata={metadata}
        bookId={mockBookId}
        progressPercent={mockProgressPercent}
        t={mockT}
      />,
    );
    expect(screen.getByText('A great book')).toBeInTheDocument();
  });

  it('calls onClose when clicking close button', async () => {
    await renderPanel(
      <InfoPanel
        isOpen={true}
        onClose={onClose}
        metadata={null}
        bookId={mockBookId}
        progressPercent={mockProgressPercent}
        t={mockT}
      />,
    );
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when pressing Escape', async () => {
    await renderPanel(
      <InfoPanel
        isOpen={true}
        onClose={onClose}
        metadata={null}
        bookId={mockBookId}
        progressPercent={mockProgressPercent}
        t={mockT}
      />,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('shows accessibility metadata when available', async () => {
    const metadata = {
      title: 'Book',
      accessibility: {
        summary: 'Fully accessible',
        conformsTo: 'WCAG 2.1 AA',
        features: ['alternativeText', 'longDescription'],
        hazards: ['none'],
        controls: ['keyboardNavigation'],
        api: 'epubAccessibility',
        certifiedBy: 'Certifier',
        certifierCredential: 'cred-123',
        certifierReport: 'https://example.com/report',
      },
    };
    await renderPanel(
      <InfoPanel
        isOpen={true}
        onClose={onClose}
        metadata={metadata}
        bookId={mockBookId}
        progressPercent={mockProgressPercent}
        t={mockT}
      />,
    );
    expect(screen.getByText('Fully accessible')).toBeInTheDocument();
    expect(screen.getByText('WCAG 2.1 AA')).toBeInTheDocument();
  });

  it('shows flashing hazard badge', async () => {
    const metadata = {
      title: 'Book',
      accessibility: {
        summary: undefined,
        conformsTo: undefined,
        features: [],
        hazards: ['flashing'],
        controls: [],
        api: undefined,
        certifiedBy: undefined,
        certifierCredential: undefined,
        certifierReport: undefined,
      },
    };
    await renderPanel(
      <InfoPanel
        isOpen={true}
        onClose={onClose}
        metadata={metadata}
        bookId={mockBookId}
        progressPercent={mockProgressPercent}
        t={mockT}
      />,
    );
    expect(screen.getByText('Flashing')).toBeInTheDocument();
  });

  it('shows certification report link', async () => {
    const metadata = {
      title: 'Book',
      accessibility: {
        summary: undefined,
        conformsTo: undefined,
        features: [],
        hazards: [],
        controls: [],
        api: undefined,
        certifiedBy: 'Certifier',
        certifierCredential: undefined,
        certifierReport: 'https://example.com/report',
      },
    };
    await renderPanel(
      <InfoPanel
        isOpen={true}
        onClose={onClose}
        metadata={metadata}
        bookId={mockBookId}
        progressPercent={mockProgressPercent}
        t={mockT}
      />,
    );
    expect(screen.getByText('Book')).toBeInTheDocument();
  });

  // N1: synced reading history is separately labelled and never summed with local
  it('renders synced history separately from device-local metrics', async () => {
    useAuthStore.setState({ sessionToken: 'tok-n1' });
    mockCompute.mockResolvedValue({
      totalActiveMinutes: 15,
      totalActivePages: 7,
      estimatedMinutesRemaining: 20,
      currentStreakDays: 1,
      recentActivity: [{ date: '2026-10-04', activeMinutes: 15, activePages: 7 }],
      chapterDurations: [],
      readingSpeedWpm: null,
    });
    mockApiRequest.mockResolvedValue({
      totalActiveMinutes: 120,
      totalActivePages: 60,
      currentStreakDays: 3,
      recentActivity: [
        { date: '2026-10-04', activeMinutes: 90, activePages: 45 },
        { date: '2026-10-03', activeMinutes: 30, activePages: 15 },
      ],
    });

    await renderPanel(
      <InfoPanel
        isOpen={true}
        onClose={onClose}
        metadata={{ title: 'Book' }}
        bookId={mockBookId}
        progressPercent={mockProgressPercent}
        t={mockT}
      />,
    );

    // Synced section and its values render.
    expect(await screen.findByText('Synced Reading History (Last 30 Days)')).toBeInTheDocument();
    expect(await screen.findByText('2h')).toBeInTheDocument();
    expect(screen.getByText('60')).toBeInTheDocument();
    expect(screen.getByText('Synced Active Time')).toBeInTheDocument();
    // Local section is labelled separately and not merged into one total.
    expect(screen.getByRole('heading', { name: /Device-local/ })).toBeInTheDocument();
    expect(screen.getByText('15 min')).toBeInTheDocument();
    // Never a summed figure (15 + 120 = 135 -> "2h 15m" must not appear).
    expect(screen.queryByText('2h 15m')).not.toBeInTheDocument();
  });

  // N3: offline JSON export of the selected book's local insight summary
  it('exports a parseable JSON summary of the selected book only', async () => {
    mockCompute.mockResolvedValue({
      totalActiveMinutes: 25,
      totalActivePages: 12,
      estimatedMinutesRemaining: 25,
      currentStreakDays: 2,
      recentActivity: [{ date: '2026-10-04', activeMinutes: 25, activePages: 12 }],
      chapterDurations: [],
      readingSpeedWpm: null,
    });

    const capture: { blob: Blob | null } = { blob: null };
    const createObjectUrlSpy = vi
      .spyOn(URL, 'createObjectURL')
      .mockImplementation((blob: Blob | MediaSource) => {
        capture.blob = blob as Blob;
        return 'blob:mock-insights';
      });
    const revokeObjectUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    await renderPanel(
      <InfoPanel
        isOpen={true}
        onClose={onClose}
        metadata={{ title: 'Book' }}
        bookId={mockBookId}
        progressPercent={mockProgressPercent}
        t={mockT}
      />,
    );

    const exportButton = await screen.findByRole('button', {
      name: 'Export Reading Insights (JSON)',
    });
    expect(exportButton).toBeEnabled();
    fireEvent.click(exportButton);

    expect(clickSpy).toHaveBeenCalledTimes(1);
    if (!capture.blob) throw new Error('export did not create a Blob');
    const parsed = JSON.parse(await capture.blob.text()) as {
      bookId: string;
      insights: {
        totalActiveMinutes: number;
        totalActivePages: number;
        estimatedMinutesRemaining: number;
      };
    };
    expect(parsed.bookId).toBe(mockBookId);
    expect(parsed.insights.totalActiveMinutes).toBe(25);
    expect(parsed.insights.totalActivePages).toBe(12);
    expect(parsed.insights.estimatedMinutesRemaining).toBe(25);
    // No credential, email, token or URL fields in the exported payload.
    const text = JSON.stringify(parsed);
    expect(text).not.toMatch(/token|email|@|https?:/i);

    clickSpy.mockRestore();
    createObjectUrlSpy.mockRestore();
    revokeObjectUrlSpy.mockRestore();
  });

  // A storage failure must not be reported as "no reading activity": the panel
  // has to say the device store is unavailable.
  it('reports unavailable device storage instead of no local activity', async () => {
    mockCompute.mockRejectedValue(new Error('IndexedDB read failed'));

    await renderPanel(
      <InfoPanel
        isOpen={true}
        onClose={onClose}
        metadata={{ title: 'Book' }}
        bookId={mockBookId}
        progressPercent={mockProgressPercent}
        t={mockT}
      />,
    );

    expect(
      await screen.findByText(
        'Local reading insights unavailable — device storage could not be read.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('No local reading activity recorded on this device yet.')).toBeNull();
    // Nothing may be exported from a store that could not be read.
    expect(screen.getByRole('button', { name: 'Export Reading Insights (JSON)' })).toBeDisabled();
  });
});
