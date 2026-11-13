import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RenditionSelector } from '../RenditionSelector';
import { en } from '../../../../../i18n/en';
import type { RenditionItem } from '@do-epub-studio/reader-core';

function mockT(key: string, params?: Record<string, string | number>): string {
  const dict = en as unknown as Record<string, string | Record<string, string>>;
  const val = dict[key];
  let str = typeof val === 'string' ? val : key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replace(`{${k}}`, String(v)).replace(`{{${k}}}`, String(v));
    }
  }
  return str;
}

describe('RenditionSelector', () => {
  const mockRenditions: RenditionItem[] = [
    {
      id: 'default',
      fullPath: 'OEBPS/content.opf',
      mediaType: 'application/oebps-package+xml',
      label: 'Reflowable (Default)',
      isDefault: true,
      layout: 'reflowable',
    },
    {
      id: 'alternate',
      fullPath: 'OEBPS/alternate.opf',
      mediaType: 'application/oebps-package+xml',
      label: 'Fixed Layout',
      isDefault: false,
      layout: 'pre-paginated',
    },
  ];

  it('renders nothing when there is only one or zero renditions', () => {
    const { container } = render(
      <RenditionSelector
        renditions={[mockRenditions[0] as RenditionItem]}
        activeRendition={mockRenditions[0] as RenditionItem}
        onSelectRendition={vi.fn()}
        t={mockT}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders selector button displaying active rendition label when multiple renditions exist', () => {
    render(
      <RenditionSelector
        renditions={mockRenditions}
        activeRendition={mockRenditions[0] as RenditionItem}
        onSelectRendition={vi.fn()}
        t={mockT}
      />,
    );

    const button = screen.getByRole('button', { name: 'Select edition or rendition' });
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent('Reflowable (Default)');
  });

  it('opens menu and selects alternative rendition', () => {
    const onSelect = vi.fn();
    render(
      <RenditionSelector
        renditions={mockRenditions}
        activeRendition={mockRenditions[0] as RenditionItem}
        onSelectRendition={onSelect}
        t={mockT}
      />,
    );

    const toggleButton = screen.getByRole('button', { name: 'Select edition or rendition' });
    fireEvent.click(toggleButton);

    const menu = screen.getByRole('menu', { name: 'Renditions' });
    expect(menu).toBeInTheDocument();

    const options = screen.getAllByRole('menuitemradio');
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveAttribute('aria-checked', 'true');
    expect(options[1]).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(options[1] as HTMLElement);
    expect(onSelect).toHaveBeenCalledWith('OEBPS/alternate.opf');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes menu when Escape key is pressed', () => {
    render(
      <RenditionSelector
        renditions={mockRenditions}
        activeRendition={mockRenditions[0] as RenditionItem}
        onSelectRendition={vi.fn()}
        t={mockT}
      />,
    );

    const toggleButton = screen.getByRole('button', { name: 'Select edition or rendition' });
    fireEvent.click(toggleButton);
    expect(screen.getByRole('menu')).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
