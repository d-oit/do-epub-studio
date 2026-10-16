import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { useAuthStore } from '../../../../stores/auth';
import { ReaderViewer } from './ReaderViewer';

describe('ReaderViewer', () => {
  const mockRef = { current: null as HTMLDivElement | null };

  beforeEach(() => {
    useAuthStore.setState({ bookTitle: null });
  });

  it('renders loading state', () => {
    render(
      <ReaderViewer
        isLoading={true}
        epubUrl={null}
        error={null}
        pageWidthClass="max-w-3xl"
        viewerRef={{ current: null }}
        notAvailableText="No book selected"
      />,
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
      />,
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
      />,
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
      />,
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
      />,
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
      />,
    );
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
  });

  it('names the book iframes as epub.js creates them', async () => {
    useAuthStore.setState({ bookTitle: 'Test Book' });
    const ref = { current: null as HTMLDivElement | null };
    render(
      <ReaderViewer
        isLoading={false}
        epubUrl="https://example.com/book.epub"
        error={null}
        pageWidthClass="max-w-3xl"
        viewerRef={ref}
        notAvailableText="No book selected"
      />,
    );

    // epub.js renders neighbouring views by appending bare <iframe>s to the
    // render target; axe reports a missing accessible name on them (serious
    // `frame-title`), and the frames appear after mount, so the naming has to
    // follow the DOM.
    const frame = document.createElement('iframe');
    ref.current?.appendChild(frame);

    await waitFor(() => {
      expect(frame.getAttribute('title')).toBe('Test Book');
    });
  });
});
