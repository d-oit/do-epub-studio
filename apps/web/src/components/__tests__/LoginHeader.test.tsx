import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LoginHeader } from '../LoginHeader';

vi.mock('../LocaleSwitcher', () => ({
  LocaleSwitcher: () => <div data-testid="locale-switcher" />,
}));

vi.mock('../ThemeToggle', () => ({
  ThemeToggle: () => <button data-testid="theme-toggle" type="button">Theme</button>,
}));

describe('LoginHeader', () => {
  it('renders a semantic header container with test id', () => {
    render(<LoginHeader />);
    const header = screen.getByTestId('login-header-controls');
    expect(header.tagName).toBe('HEADER');
    expect(header).toHaveClass('relative', 'z-20', 'flex', 'w-full', 'max-w-7xl');
  });

  it('contains ThemeToggle and LocaleSwitcher within a flex-wrap container', () => {
    render(<LoginHeader />);
    expect(screen.getByTestId('theme-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('locale-switcher')).toBeInTheDocument();

    const controlsContainer = screen.getByTestId('theme-toggle').parentElement;
    expect(controlsContainer).toHaveClass('flex', 'flex-wrap', 'items-center', 'justify-end');
  });

  it('merges optional custom className props', () => {
    render(<LoginHeader className="custom-test-class" />);
    const header = screen.getByTestId('login-header-controls');
    expect(header).toHaveClass('custom-test-class');
  });
});
