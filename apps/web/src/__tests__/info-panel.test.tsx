import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InfoPanel } from '../features/reader/components/info/InfoPanel';

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    'reader.aboutBook': 'About Book',
    'reader.settings.close': 'Close',
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
  };
  return translations[key] ?? key;
};

describe('InfoPanel', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    render(<InfoPanel isOpen={false} onClose={onClose} metadata={null} t={mockT} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders dialog when isOpen is true', () => {
    render(<InfoPanel isOpen={true} onClose={onClose} metadata={null} t={mockT} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('shows no metadata message when metadata is null', () => {
    render(<InfoPanel isOpen={true} onClose={onClose} metadata={null} t={mockT} />);
    expect(screen.getByText('No metadata available')).toBeInTheDocument();
  });

  it('shows book details when metadata provided', () => {
    const metadata = { title: 'My Book', creator: 'Author Name', publisher: 'Publisher', language: 'en' };
    render(<InfoPanel isOpen={true} onClose={onClose} metadata={metadata} t={mockT} />);
    expect(screen.getByText('My Book')).toBeInTheDocument();
  });

  it('shows description when provided', () => {
    const metadata = { title: 'Book', description: 'A great book' };
    render(<InfoPanel isOpen={true} onClose={onClose} metadata={metadata} t={mockT} />);
    expect(screen.getByText('A great book')).toBeInTheDocument();
  });

  it('calls onClose when clicking close button', () => {
    render(<InfoPanel isOpen={true} onClose={onClose} metadata={null} t={mockT} />);
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when pressing Escape', () => {
    render(<InfoPanel isOpen={true} onClose={onClose} metadata={null} t={mockT} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('shows accessibility metadata when available', () => {
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
    render(<InfoPanel isOpen={true} onClose={onClose} metadata={metadata} t={mockT} />);
    expect(screen.getByText('Fully accessible')).toBeInTheDocument();
    expect(screen.getByText('WCAG 2.1 AA')).toBeInTheDocument();
  });

  it('shows flashing hazard badge', () => {
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
    render(<InfoPanel isOpen={true} onClose={onClose} metadata={metadata} t={mockT} />);
    expect(screen.getByText('Flashing')).toBeInTheDocument();
  });

  it('shows certification report link', () => {
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
    render(<InfoPanel isOpen={true} onClose={onClose} metadata={metadata} t={mockT} />);
    expect(screen.getByText('Book')).toBeInTheDocument();
  });
});
