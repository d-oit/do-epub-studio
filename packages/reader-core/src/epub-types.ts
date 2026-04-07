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

export interface BookMetadata {
  title: string;
  creator?: string;
  language?: string;
  publisher?: string;
  description?: string;
  cover?: string;
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
