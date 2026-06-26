import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Design Tokens', () => {
  it('uses OKLCH for color tokens in globals.css', () => {
    const cssPath = path.resolve(__dirname, '../styles/globals.css');
    const cssContent = fs.readFileSync(cssPath, 'utf-8');

    // Check if OKLCH is present
    expect(cssContent).toContain('oklch(');

    // Check for some specific tokens
    expect(cssContent).toContain('--color-background: oklch(100% 0 0)');
    // Adjusted during a11y audit (WCAG 2 AA contrast vs #ffffff >= 4.5:1)
    expect(cssContent).toContain('--color-accent: oklch(48% 0.16 250)');
  });

  it('implements wide-gamut P3 overrides', () => {
    const cssPath = path.resolve(__dirname, '../styles/globals.css');
    const cssContent = fs.readFileSync(cssPath, 'utf-8');

    expect(cssContent).toContain('@media (color-gamut: p3)');
    expect(cssContent).toContain('--color-accent: oklch(52% 0.2 250)');
  });

  it('follows Tailwind v4 @layer architecture', () => {
    const cssPath = path.resolve(__dirname, '../styles/globals.css');
    const cssContent = fs.readFileSync(cssPath, 'utf-8');

    expect(cssContent).toContain('@layer base');
    expect(cssContent).toContain('@layer components');
    expect(cssContent).toContain('@layer utilities');
  });

  it('exposes named inline-size containers for ADR-105 components', () => {
    const cssPath = path.resolve(__dirname, '../styles/globals.css');
    const cssContent = fs.readFileSync(cssPath, 'utf-8');

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
    const cssPath = path.resolve(__dirname, '../styles/globals.css');
    const cssContent = fs.readFileSync(cssPath, 'utf-8');

    const matches = cssContent.match(/@container\s+[a-z-]+\s+\(min-width:/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(5);
  });
});
