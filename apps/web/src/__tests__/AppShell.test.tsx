import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { AppShell } from '../components/AppShell';
import { BrowserRouter } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';

// Mock navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('AppShell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    useAuthStore.setState({
      isAuthenticated: false,
      isAdmin: false,
      bookSlug: null,
      email: null,
      capabilities: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders loading state initially', () => {
    render(
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>,
    );
    // Looking for the AppLogo SVG
    expect(document.querySelector('svg[role="img"]')).toBeInTheDocument();
  });

  it('redirects to login when not authenticated after timeout', () => {
    render(
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>,
    );

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(mockNavigate).toHaveBeenCalledWith('/login', expect.objectContaining({ replace: true }));
  });

  it('redirects to reader when authenticated as user', () => {
    useAuthStore.setState({ isAuthenticated: true, isAdmin: false, bookSlug: 'my-book' });
    render(
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>,
    );

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(mockNavigate).toHaveBeenCalledWith('/read/my-book', expect.objectContaining({ replace: true }));
  });

  it('redirects to admin when authenticated as admin', () => {
    useAuthStore.setState({ isAuthenticated: true, isAdmin: true, bookSlug: null });
    render(
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>,
    );

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(mockNavigate).toHaveBeenCalledWith('/admin/books', expect.objectContaining({ replace: true }));
  });
});
