import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LoginHeader } from '../LoginHeader';

vi.mock('../LocaleSwitcher', () => ({
  LocaleSwitcher: () => <div data-testid="locale-switcher" />,
}));

vi.mock('../ThemeToggle', () => ({
  ThemeToggle: () => <div data-testid="theme-toggle" />,
}));

describe('LoginHeader', () => {
  it('renders theme toggle and locale switcher inside a header element', () => {
    const { container } = render(<LoginHeader />);
    const header = container.querySelector('header');
    expect(header).toBeInTheDocument();
    expect(header).toHaveClass('w-full', 'flex', 'flex-wrap', 'items-center', 'justify-end');
    expect(screen.getByTestId('theme-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('locale-switcher')).toBeInTheDocument();
  });

  it('applies custom className when provided', () => {
    const { container } = render(<LoginHeader className="custom-class" />);
    const header = container.querySelector('header');
    expect(header).toHaveClass('custom-class');
  });
});
