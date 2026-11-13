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

export type WritingMode =
  'horizontal-tb' | 'vertical-rl' | 'vertical-lr' | 'sideways-rl' | 'sideways-lr';

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

export interface MediaOverlayClip {
  id?: string;
  /** Document-relative or publication-relative text fragment href, e.g. "chapter.xhtml#line" */
  textHref: string;
  /** Element ID extracted from textHref if present, e.g. "line" */
  elementId?: string;
  /** Publication/archive-relative path to the audio file */
  audioSrc: string;
  /** Begin offset in seconds */
  clipBegin: number;
  /** End offset in seconds */
  clipEnd: number;
  /** Duration of the clip in seconds */
  duration: number;
}

export interface MediaOverlaySequence {
  id?: string;
  /** Associated document href, e.g. "chapter.xhtml" */
  textRef?: string;
  /** SMIL archive-relative path */
  smilPath: string;
  /** Ordered list of synchronized clips */
  clips: MediaOverlayClip[];
  /** Total duration in seconds of this sequence */
  totalDuration: number;
}

export interface MediaOverlayManifest {
  /** Map of normalized chapter / document href to its MediaOverlaySequence */
  sequencesByChapter: Record<string, MediaOverlaySequence>;
  /** Total audio duration across all sequences in seconds */
  totalDuration: number;
  /** Whether the publication has any valid media overlays */
  hasMediaOverlays: boolean;
}
