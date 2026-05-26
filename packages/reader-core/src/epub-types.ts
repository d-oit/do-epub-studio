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

export interface BookMetadata {
  title: string;
  creator?: string;
  language?: string;
  publisher?: string;
  description?: string;
  cover?: string;
  direction?: PageDirection;
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
