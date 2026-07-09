import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Drawer } from '../components/navigation/Drawer';

vi.mock('../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'nav.library': 'Library',
        'reader.settings.close': 'Close',
        'reader.library': 'Library',
        'reader.settings': 'Settings',
      };
      return translations[key] ?? key;
    },
  }),
}));

vi.mock('../components/ui', () => ({
  AppLogo: ({ size: _size, ...props }: any) => <div data-testid="app-logo" {...props} />,
}));

vi.mock('../components/navigation/shared', () => ({
  NAV_ITEMS: [
    { key: 'reader.library', icon: 'library', href: '/library' },
    { key: 'reader.settings', icon: 'settings', href: '/settings' },
  ],
  NavIcon: ({ icon, ...props }: any) => <span data-testid={`nav-icon-${icon}`} {...props} />,
}));

describe('Drawer', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    render(
      <MemoryRouter>
        <Drawer isOpen={false} onClose={onClose} />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders dialog when isOpen is true', () => {
    render(
      <MemoryRouter>
        <Drawer isOpen={true} onClose={onClose} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('renders navigation items', () => {
    render(
      <MemoryRouter>
        <Drawer isOpen={true} onClose={onClose} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Library')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('calls onClose when clicking close button', () => {
    render(
      <MemoryRouter>
        <Drawer isOpen={true} onClose={onClose} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when clicking scrim', () => {
    render(
      <MemoryRouter>
        <Drawer isOpen={true} onClose={onClose} />
      </MemoryRouter>,
    );
    const scrim = document.querySelector('.fixed.inset-0');
    if (scrim) {
      fireEvent.click(scrim);
      expect(onClose).toHaveBeenCalled();
    }
  });
});
