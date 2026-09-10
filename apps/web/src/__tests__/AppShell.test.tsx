import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppShell } from '../components/AppShell';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../components/ui', () => ({
  AppLogo: () => <svg role="img" aria-label="logo" />,
}));

vi.mock('../components/navigation', () => ({
  BottomTabBar: () => <nav aria-label="tabs" />,
  Sidebar: () => <aside className="sidebar-nav" />,
  Drawer: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => (
    isOpen ? <aside role="dialog" aria-label="drawer"><button type="button" onClick={onClose}>close</button></aside> : null
  ),
}));

vi.mock('../config/app-identity', () => ({
  APP_NAME: 'App',
  APP_VERSION_LABEL: 'v0',
}));

function renderShell(initialEntry = '/catalog') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/catalog" element={<div>Catalog content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('AppShell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // GOAP-268 UX-01: the shell is a pure layout — no timer, no redirect.
  it('renders nested route content inside a single main landmark immediately', () => {
    renderShell();
    expect(screen.getByText('Catalog content')).toBeInTheDocument();
    const mains = document.querySelectorAll('main#main-content');
    expect(mains).toHaveLength(1);
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
  });

  it('exposes the skip-link target and persistent navigation chrome', () => {
    renderShell();
    expect(document.getElementById('main-content')).toBeInTheDocument();
    expect(document.querySelector('.sidebar-nav')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'tabs' })).toBeInTheDocument();
  });

  it('opens and closes the drawer from the mobile menu trigger', () => {
    renderShell();
    fireEvent.click(screen.getByRole('button', { name: 'a11y.menu_open' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByText('close'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
