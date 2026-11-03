import type { Rendition, Contents } from '@intity/epub-js';
import type { PageDirection } from '../../../stores';

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

interface DirectionSettings {
  dir: string;
}

/** Latest direction per rendition; the content hook reads this. */
const directionSettings = new WeakMap<Rendition, DirectionSettings>();

function applyDirectionToContents(contents: Contents, dir: string): void {
  if (contents.document?.documentElement) {
    contents.document.documentElement.setAttribute('dir', dir);
  }
  contents.direction(dir);
}

/**
 * Applies reading direction to the rendered chapter *and* to every chapter
 * loaded later. The content hook is registered once per rendition — registering
 * it on every preference change piled up hooks — and the current contents are
 * updated immediately, because a hook only fires for content that loads
 * afterwards. Writing mode rides the rendition theme (`createThemeApplier`).
 */
export function applyDirection(rendition: Rendition, direction: PageDirection): void {
  const dir = direction === 'default' ? document.documentElement.dir || 'ltr' : direction;
  let settings = directionSettings.get(rendition);
  if (!settings) {
    settings = { dir };
    directionSettings.set(rendition, settings);
    rendition.hooks.content.register((contents: Contents) => {
      const current = directionSettings.get(rendition);
      if (current) applyDirectionToContents(contents, current.dir);
    });
  } else {
    settings.dir = dir;
  }
  for (const contents of rendition.getContents()) {
    if (contents) applyDirectionToContents(contents, settings.dir);
  }
}
