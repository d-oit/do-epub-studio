import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReaderViewer } from './ReaderViewer';

describe('ReaderViewer', () => {
  const mockRef = { current: null as HTMLDivElement | null };

  it('renders loading state', () => {
    render(
      <ReaderViewer
        isLoading={true}
        epubUrl={null}
        error={null}
        pageWidthClass="max-w-3xl"
        viewerRef={{ current: null }}
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
        viewerRef={{ current: null }}
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
        viewerRef={{ current: null }}
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

  it('keeps the sized surface off the rendition render target', () => {
    const ref = { current: null as HTMLDivElement | null };
    render(
      <ReaderViewer
        isLoading={false}
        epubUrl="https://example.com/book.epub"
        error={null}
        pageWidthClass="max-w-3xl"
        viewerRef={ref}
        notAvailableText="No book selected"
      />
    );

    // epub.js Viewport.updateFlow runs `target.className = flow` on the render
    // target and sizes views from the target's clientHeight. Classes therefore
    // cannot carry the reader's height: previously the target's height utility
    // was deleted and the reader collapsed into a blank 0-height viewport.
    const host = ref.current;
    expect(host).not.toBeNull();
    expect(host?.getAttribute('style')).toContain('height: 100%');
    expect(String(host?.className)).not.toContain('h-[calc(100dvh-8rem)]');
    expect(String(host?.parentElement?.className)).toContain('h-[calc(100dvh-8rem)]');
  });

  it('has id="main-content" on the main element', () => {
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
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
  });
});
