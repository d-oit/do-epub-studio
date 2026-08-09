import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  LibrarySkeleton,
  CatalogSkeleton,
  AdminSkeleton,
  ReaderSkeleton,
  SettingsSkeleton,
} from '../skeletons';

vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => (key === 'a11y.loading_page' ? 'Loading page' : key),
    locale: 'en' as const,
    setLocale: vi.fn(),
  }),
}));

const SKELETONS = [
  ['LibrarySkeleton', LibrarySkeleton],
  ['CatalogSkeleton', CatalogSkeleton],
  ['AdminSkeleton', AdminSkeleton],
  ['ReaderSkeleton', ReaderSkeleton],
  ['SettingsSkeleton', SettingsSkeleton],
] as const;

describe('page skeleton components', () => {
  for (const [name, Skeleton] of SKELETONS) {
    it(`${name} renders with role="status" and aria-busy`, () => {
      const { container } = render(<Skeleton />);
      const status = container.querySelector('[role="status"]');
      expect(status, `${name} must have role="status"`).not.toBeNull();
      expect(status?.getAttribute('aria-busy')).toBe('true');
      expect(status?.getAttribute('aria-label')).toBeTruthy();
    });

    it(`${name} uses translated aria-label`, () => {
      const { container } = render(<Skeleton />);
      const status = container.querySelector('[role="status"]');
      expect(status?.getAttribute('aria-label')).toBe('Loading page');
    });

    it(`${name} renders animate-pulse decorative blocks`, () => {
      const { container } = render(<Skeleton />);
      const pulseBlocks = container.querySelectorAll('.animate-pulse');
      expect(pulseBlocks.length).toBeGreaterThan(0);
    });
  }

  it('all skeleton decorative blocks are aria-hidden', () => {
    const { container } = render(<LibrarySkeleton />);
    // Structural containers should be aria-hidden; status container should not
    const hiddenEls = container.querySelectorAll('[aria-hidden="true"]');
    expect(hiddenEls.length).toBeGreaterThan(0);
    // The root role="status" must NOT be aria-hidden
    const status = container.querySelector('[role="status"]');
    expect(status?.getAttribute('aria-hidden')).toBeNull();
  });

  it('skeletons do not render visible text (decorative blocks only)', () => {
    render(<LibrarySkeleton />);
    // No visible text children — all content is aria-hidden decorative blocks
    expect(screen.queryAllByText(/./)).toHaveLength(0);
  });
});
