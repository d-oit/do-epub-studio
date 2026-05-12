import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReaderViewer } from './ReaderViewer';

describe('ReaderViewer', () => {
  const mockRef = { current: null as unknown as HTMLDivElement };

  it('renders loading state', () => {
    render(
      <ReaderViewer
        isLoading={true}
        epubUrl={null}
        error={null}
        pageWidthClass="max-w-3xl"
        viewerRef={{ current: null as unknown as HTMLDivElement }}
        notAvailableText="No book selected"
      />
    );
    expect(screen.getByRole('main')).toBeTruthy();
  });

  it('renders error state', () => {
    render(
      <ReaderViewer
        isLoading={false}
        epubUrl={null}
        error="Failed to load book"
        pageWidthClass="max-w-3xl"
        viewerRef={{ current: null as unknown as HTMLDivElement }}
        notAvailableText="No book selected"
      />
    );
    expect(screen.getByText('Failed to load book')).toBeTruthy();
  });

  it('renders not available state when no epubUrl', () => {
    render(
      <ReaderViewer
        isLoading={false}
        epubUrl={null}
        error={null}
        pageWidthClass="max-w-3xl"
        viewerRef={{ current: null as unknown as HTMLDivElement }}
        notAvailableText="No book selected"
      />
    );
    expect(screen.getByText('No book selected')).toBeTruthy();
  });

  it('renders viewer with epubUrl', () => {
    render(
      <ReaderViewer
        isLoading={false}
        epubUrl="https://example.com/book.epub"
        error={null}
        pageWidthClass="max-w-3xl"
        viewerRef={mockRef}
        notAvailableText="No book selected"
      />
    );
    expect(screen.getByRole('main')).toBeTruthy();
  });
});