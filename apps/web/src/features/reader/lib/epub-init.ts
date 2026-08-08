import type { Rendition, Contents } from '@intity/epub-js';
import type { PageDirection, WritingMode } from '../../../stores';

export interface TocItem {
  label: string;
  href: string;
  subitems?: TocItem[];
}

export interface BookInfo {
  title: string;
  creator?: string;
  publisher?: string;
  language?: string;
  description?: string;
  accessibility?: {
    summary?: string;
    features: string[];
    hazards: string[];
    controls: string[];
    api?: string;
    conformsTo?: string;
    certifiedBy?: string;
    certifierCredential?: string;
    certifierReport?: string;
  };
}

export function applyDirectionAndWritingMode(
  rendition: Rendition,
  direction: PageDirection,
  writingMode: WritingMode,
): void {
  const dir = direction === 'default' ? document.documentElement.dir || 'ltr' : direction;
  rendition.hooks.content.register((contents: Contents) => {
    if (contents.document?.documentElement) {
      contents.document.documentElement.setAttribute('dir', dir);
    }
    contents.direction(dir);
    if (writingMode !== 'horizontal-tb') {
      contents.css('writing-mode', writingMode, true);
    }
  });
}
