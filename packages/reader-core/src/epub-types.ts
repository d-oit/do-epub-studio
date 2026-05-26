export interface TocItem {
  id: string;
  label: string;
  href: string;
  subitems?: TocItem[];
}

export interface SpineItem {
  index: number;
  href: string;
  properties?: string;
}

export type PageDirection = 'ltr' | 'rtl' | 'default';

export type WritingMode = 'horizontal-tb' | 'vertical-rl' | 'vertical-lr' | 'sideways-rl' | 'sideways-lr';

export interface FixedLayoutInfo {
  layout?: 'reflowable' | 'pre-paginated';
  orientation?: 'auto' | 'landscape' | 'portrait';
  spread?: 'none' | 'auto' | 'both' | 'landscape';
  viewport?: string;
}

export interface BookMetadata {
  title: string;
  creator?: string;
  language?: string;
  publisher?: string;
  description?: string;
  cover?: string;
  direction?: PageDirection;
  fixedLayout?: FixedLayoutInfo;
}

export interface ProgressPosition {
  cfi: string;
  percentage: number;
  displayed?: {
    index: number;
    href: string;
  };
}

export interface Selection {
  cfiRange: string;
  text: string;
  chapterRef?: string;
}
