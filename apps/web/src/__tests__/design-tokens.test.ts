import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const CSS_PATH = path.resolve(__dirname, '../styles/globals.css');

describe('Design Tokens', () => {
  it('uses OKLCH for color tokens in globals.css', () => {
    const cssContent = fs.readFileSync(CSS_PATH, 'utf-8');

    // Check if OKLCH is present
    expect(cssContent).toContain('oklch(');

    // Check for some specific tokens
    expect(cssContent).toContain('--color-background: oklch(97.6% 0.011 84)');
    // Adjusted during a11y audit (WCAG 2 AA contrast vs #ffffff >= 4.5:1)
    expect(cssContent).toContain('--color-accent: oklch(55% 0.15 52)');
  });

  it('implements wide-gamut P3 overrides', () => {
    const cssContent = fs.readFileSync(CSS_PATH, 'utf-8');

    expect(cssContent).toContain('@media (color-gamut: p3)');
    expect(cssContent).toContain('--color-accent: oklch(57% 0.17 52)');
  });

  it('follows Tailwind v4 @layer architecture', () => {
    const cssContent = fs.readFileSync(CSS_PATH, 'utf-8');

    expect(cssContent).toContain('@layer base');
    expect(cssContent).toContain('@layer components');
    expect(cssContent).toContain('@layer utilities');
  });

  it('exposes named inline-size containers for ADR-105 components', () => {
    const cssContent = fs.readFileSync(CSS_PATH, 'utf-8');

    for (const name of [
      'toc-panel',
      'search-panel',
      'bookmarks-panel',
      'annotation-toolbar',
      'reader-toolbar',
      'catalog-grid',
      'admin-books-grid',
      'admin-audit-table',
    ]) {
      expect(cssContent).toContain(`container-name: ${name}`);
    }
    expect(cssContent).toMatch(/container-type:\s*inline-size/);
  });

  it('ships at least one @container rule per refactored component', () => {
    const cssContent = fs.readFileSync(CSS_PATH, 'utf-8');

    const matches = cssContent.match(/@container\s+[a-z-]+\s+\(min-width:/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(5);
  });

  it('exposes the sparkle editorial utilities (GOAP-255)', () => {
    const cssContent = fs.readFileSync(CSS_PATH, 'utf-8');

    expect(cssContent).toContain('.paper-grain');
    expect(cssContent).toContain('.eyebrow');
    expect(cssContent).toContain('--shadow-page:');
    expect(cssContent).toContain('--shadow-spine:');
  });

  it('keeps the sepia theme block intact', () => {
    const cssContent = fs.readFileSync(CSS_PATH, 'utf-8');

    expect(cssContent).toContain('[data-theme="sepia"]');
  });
});
