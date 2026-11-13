import type { MediaOverlayClip, MediaOverlaySequence, MediaOverlayManifest } from './epub-types';

/** Maximum allowed SMIL document size in bytes (1 MiB) */
export const MAX_SMIL_BYTES = 1024 * 1024;

/** Maximum allowed clips per sequence to prevent resource exhaustion */
export const MAX_CLIPS_PER_SEQUENCE = 5_000;

/** Maximum allowed duration for a single clip in seconds (4 hours) */
export const MAX_CLIP_DURATION_SECONDS = 14_400;

export class MediaOverlayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MediaOverlayError';
  }
}

/**
 * Normalizes a path relative to a base directory inside the publication archive.
 * Rejects absolute URLs, protocols, Windows drive letters, and traversal escaping the root.
 */
export function normalizePublicationPath(baseDir: string, relativePath: string): string {
  const trimmed = relativePath.trim();
  if (!trimmed) throw new MediaOverlayError('Empty resource path');
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed) || trimmed.startsWith('//')) {
    throw new MediaOverlayError(`Remote resources are forbidden: ${trimmed}`);
  }
  if (/^[a-zA-Z]:/.test(trimmed)) {
    throw new MediaOverlayError(`Absolute drive paths are forbidden: ${trimmed}`);
  }
  const hashIdx = trimmed.indexOf('#');
  const pathPart = hashIdx >= 0 ? trimmed.slice(0, hashIdx) : trimmed;
  const fragmentPart = hashIdx >= 0 ? trimmed.slice(hashIdx) : '';
  const combined = pathPart.startsWith('/')
    ? pathPart.split('/').filter(Boolean)
    : [
        ...(baseDir ? baseDir.split('/').filter(Boolean) : []),
        ...pathPart.split('/').filter(Boolean),
      ];
  const resolved: string[] = [];
  for (const seg of combined) {
    if (seg === '.' || !seg) continue;
    if (seg === '..') {
      if (resolved.length === 0) {
        throw new MediaOverlayError(`Path traverses above archive root: ${relativePath}`);
      }
      resolved.pop();
    } else {
      resolved.push(seg);
    }
  }
  const normalized = resolved.join('/');
  return fragmentPart ? `${normalized}${fragmentPart}` : normalized;
}

/**
 * Parses SMIL 3.0 / EPUB 3 Clock Values into seconds.
 * Supports:
 *  - Full clock: "01:02:03" or "01:02:03.456"
 *  - Partial clock: "02:03" or "02:03.456"
 *  - Timecount with units: "10s", "250ms", "1.5min", "2h", "10"
 */
export function parseSmilClock(value: string | null | undefined): number {
  if (!value) return 0;
  const trimmed = value.trim();
  if (!trimmed) return 0;
  if (trimmed.startsWith('-')) {
    throw new MediaOverlayError(`Negative clock value forbidden: ${value}`);
  }
  if (trimmed.includes(':')) {
    const parts = trimmed.split(':');
    if (parts.length === 3) {
      const [h, m, s] = [Number(parts[0]), Number(parts[1]), Number(parts[2])];
      if (isNaN(h) || isNaN(m) || isNaN(s) || h < 0 || m < 0 || m >= 60 || s < 0 || s >= 60) {
        throw new MediaOverlayError(`Invalid full clock value: ${value}`);
      }
      return h * 3600 + m * 60 + s;
    } else if (parts.length === 2) {
      const [m, s] = [Number(parts[0]), Number(parts[1])];
      if (isNaN(m) || isNaN(s) || m < 0 || s < 0 || s >= 60) {
        throw new MediaOverlayError(`Invalid partial clock value: ${value}`);
      }
      return m * 60 + s;
    }
    throw new MediaOverlayError(`Malformed clock value: ${value}`);
  }
  const match = /^([0-9]+(?:\.[0-9]+)?)\s*(ms|s|min|h)?$/i.exec(trimmed);
  if (!match || !match[1]) throw new MediaOverlayError(`Malformed timecount clock value: ${value}`);
  const count = parseFloat(match[1]);
  const unit = (match[2] ?? 's').toLowerCase();
  const multiplier = unit === 'ms' ? 0.001 : unit === 'min' ? 60 : unit === 'h' ? 3600 : 1;
  const seconds = count * multiplier;
  if (!isFinite(seconds) || seconds < 0) {
    throw new MediaOverlayError(`Invalid computed clock seconds: ${value}`);
  }
  return seconds;
}

/**
 * Extracts directory name from a publication-relative path.
 */
function getDirectory(filePath: string): string {
  const lastSlash = filePath.lastIndexOf('/');
  return lastSlash >= 0 ? filePath.slice(0, lastSlash) : '';
}

export interface ParseSmilOptions {
  maxClips?: number;
  maxDuration?: number;
}

function createClip(
  smilDir: string,
  parId: string | undefined,
  rawTextSrc: string,
  rawAudioSrc: string,
  rawBegin: string | null | undefined,
  rawEnd: string | null | undefined,
  maxDuration: number,
): MediaOverlayClip {
  const textHref = normalizePublicationPath(smilDir, rawTextSrc);
  const audioSrc = normalizePublicationPath(smilDir, rawAudioSrc);
  const hashIdx = textHref.indexOf('#');
  const elementId = hashIdx >= 0 ? textHref.slice(hashIdx + 1) : undefined;
  const clipBegin = parseSmilClock(rawBegin);
  const clipEnd = rawEnd ? parseSmilClock(rawEnd) : clipBegin;

  if (clipEnd < clipBegin) {
    throw new MediaOverlayError(
      `clipEnd (${clipEnd}) cannot be less than clipBegin (${clipBegin})`,
    );
  }
  const duration = Math.round((clipEnd - clipBegin) * 1_000_000) / 1_000_000;
  if (duration > maxDuration) {
    throw new MediaOverlayError(
      `Clip duration (${duration}s) exceeds maximum allowed (${maxDuration}s)`,
    );
  }

  return { id: parId, textHref, elementId, audioSrc, clipBegin, clipEnd, duration };
}

/**
 * Parses a SMIL XML document and returns a MediaOverlaySequence.
 * Resolves all text and audio references relative to the SMIL document directory.
 */
export function parseSmilDocument(
  smilXml: string,
  smilPath: string,
  options?: ParseSmilOptions,
): MediaOverlaySequence {
  if (!smilXml || typeof smilXml !== 'string') {
    throw new MediaOverlayError('Empty or invalid SMIL XML');
  }

  if (smilXml.length > MAX_SMIL_BYTES) {
    throw new MediaOverlayError(`SMIL document exceeds maximum size of ${MAX_SMIL_BYTES} bytes`);
  }

  const maxClips = options?.maxClips ?? MAX_CLIPS_PER_SEQUENCE;
  const maxDuration = options?.maxDuration ?? MAX_CLIP_DURATION_SECONDS;
  const smilDir = getDirectory(smilPath);

  // Parse using DOMParser when available, with regex fallback for headless environments
  const clips: MediaOverlayClip[] = [];
  let seqId: string | undefined;
  let textRef: string | undefined;

  let normalizedXml = smilXml;
  if (normalizedXml.includes('epub:') && !normalizedXml.includes('xmlns:epub')) {
    normalizedXml = normalizedXml.replace(
      /<smil\b([^>]*)>/i,
      '<smil$1 xmlns:epub="http://www.idpf.org/2007/ops">',
    );
  }

  let parsedWithDom = false;
  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser();
    const doc = parser.parseFromString(normalizedXml, 'application/xml');
    const parserError = doc.querySelector('parsererror');
    if (!parserError) {
      parsedWithDom = true;
      const seqElem = doc.querySelector('seq');
      if (seqElem) {
        seqId = seqElem.getAttribute('id') ?? undefined;
        const rawTextRef =
          seqElem.getAttribute('epub:textref') ?? seqElem.getAttribute('textref') ?? undefined;
        if (rawTextRef) {
          textRef = normalizePublicationPath(smilDir, rawTextRef);
        }
      }

      const parElements = doc.querySelectorAll('par');
      for (const par of Array.from(parElements)) {
        if (clips.length >= maxClips) {
          throw new MediaOverlayError(`Clip count exceeds maximum allowed (${maxClips})`);
        }
        const textNode = par.querySelector('text');
        const audioNode = par.querySelector('audio');
        const rawTextSrc = textNode?.getAttribute('src');
        const rawAudioSrc = audioNode?.getAttribute('src');
        if (!audioNode || !rawTextSrc || !rawAudioSrc) continue;

        clips.push(
          createClip(
            smilDir,
            par.getAttribute('id') ?? undefined,
            rawTextSrc,
            rawAudioSrc,
            audioNode.getAttribute('clipBegin'),
            audioNode.getAttribute('clipEnd'),
            maxDuration,
          ),
        );
      }
    }
  }
  if (!parsedWithDom) {
    const seqMatch = /<seq\b([^>]*)>/i.exec(smilXml);
    if (seqMatch && seqMatch[1]) {
      const attrs = seqMatch[1];
      const idMatch = /\bid=["']([^"']+)["']/i.exec(attrs);
      if (idMatch?.[1]) seqId = idMatch[1];
      const trMatch = /\b(?:epub:)?textref=["']([^"']+)["']/i.exec(attrs);
      if (trMatch?.[1]) textRef = normalizePublicationPath(smilDir, trMatch[1]);
    }

    const parRegex = /<par\b([^>]*)>([\s\S]*?)<\/par>/gi;
    let parMatch: RegExpExecArray | null;
    while ((parMatch = parRegex.exec(smilXml)) !== null) {
      if (clips.length >= maxClips) {
        throw new MediaOverlayError(`Clip count exceeds maximum allowed (${maxClips})`);
      }
      const parAttrs = parMatch[1];
      const parBody = parMatch[2];
      if (!parAttrs || !parBody) continue;
      const idMatch = /\bid=["']([^"']+)["']/i.exec(parAttrs);
      const textMatch = /<text\b[^>]*\bsrc=["']([^"']+)["'][^>]*\/?>/i.exec(parBody);
      const audioMatch = /<audio\b([^>]*)\/?>/i.exec(parBody);
      if (!textMatch?.[1] || !audioMatch?.[1]) continue;

      const audioAttrs = audioMatch[1];
      const srcMatch = /\bsrc=["']([^"']+)["']/i.exec(audioAttrs);
      if (!srcMatch?.[1]) continue;

      const beginMatch = /\bclipBegin=["']([^"']+)["']/i.exec(audioAttrs);
      const endMatch = /\bclipEnd=["']([^"']+)["']/i.exec(audioAttrs);

      clips.push(
        createClip(
          smilDir,
          idMatch?.[1],
          textMatch[1],
          srcMatch[1],
          beginMatch?.[1] ?? null,
          endMatch?.[1] ?? null,
          maxDuration,
        ),
      );
    }
  }

  // Total duration is sum of non-overlapping clips or highest clipEnd
  let totalDuration = 0;
  for (const c of clips) {
    if (c.clipEnd > totalDuration) {
      totalDuration = c.clipEnd;
    }
  }

  return {
    id: seqId,
    textRef,
    smilPath,
    clips,
    totalDuration,
  };
}

/**
 * Finds the active MediaOverlayClip in a sequence matching the current playback time.
 */
export function findActiveClip(
  sequence: MediaOverlaySequence,
  currentTime: number,
): MediaOverlayClip | null {
  if (!sequence.clips || sequence.clips.length === 0) return null;

  for (const clip of sequence.clips) {
    if (currentTime >= clip.clipBegin && currentTime < clip.clipEnd) {
      return clip;
    }
  }

  return null;
}

export interface EpubManifestItemLike {
  id?: string;
  href?: string;
  'media-type'?: string;
  'media-overlay'?: string;
  properties?: string[];
}

export interface EpubBookLike {
  package?: {
    manifest?: Record<string, EpubManifestItemLike>;
  };
  load?: (path: string, type?: string) => Promise<unknown>;
  archive?: {
    getText?: (url: string) => Promise<string | null>;
    getBlob?: (url: string, mimeType?: string) => Promise<Blob | null>;
  };
}

/**
 * Extracts and parses all media overlay sequences from a loaded EPUB book instance.
 */
export async function extractMediaOverlays(book: unknown): Promise<MediaOverlayManifest> {
  const bookCandidate = book as EpubBookLike | null | undefined;
  const manifest = bookCandidate?.package?.manifest;
  if (!manifest) {
    return { sequencesByChapter: {}, totalDuration: 0, hasMediaOverlays: false };
  }

  const manifestItems: EpubManifestItemLike[] = Object.values(manifest);
  const itemById = new Map<string, EpubManifestItemLike>();
  for (const it of manifestItems) {
    if (it?.id) itemById.set(it.id, it);
  }

  const sequencesByChapter: Record<string, MediaOverlaySequence> = {};
  let totalDuration = 0;

  for (const it of manifestItems) {
    if (!it?.['media-overlay']) continue;
    const smilItem = itemById.get(it['media-overlay']);
    if (!smilItem?.href) continue;

    let smilXml: string | null = null;
    try {
      if (typeof bookCandidate.load === 'function') {
        const loaded = await bookCandidate.load(smilItem.href, 'text');
        if (typeof loaded === 'string') smilXml = loaded;
      } else if (bookCandidate.archive && typeof bookCandidate.archive.getText === 'function') {
        smilXml = await bookCandidate.archive.getText(smilItem.href);
      }
    } catch {
      continue;
    }

    if (!smilXml || typeof smilXml !== 'string') continue;

    try {
      const sequence = parseSmilDocument(smilXml, smilItem.href);
      if (sequence.clips.length > 0) {
        const normHref = it.href ? it.href.replace(/^\//, '') : '';
        sequencesByChapter[normHref] = sequence;
        const filename = normHref.split('/').pop();
        if (filename && filename !== normHref) {
          sequencesByChapter[filename] = sequence;
        }
        totalDuration += sequence.totalDuration;
      }
    } catch {
      continue;
    }
  }

  return {
    sequencesByChapter,
    totalDuration,
    hasMediaOverlays: Object.keys(sequencesByChapter).length > 0,
  };
}

/**
 * Resolves an audio clip's archive-relative path to a playable URL.
 */
export async function resolveAudioClipUrl(
  book: unknown,
  audioSrc: string,
): Promise<{ url: string; revoke: () => void } | null> {
  const bookCandidate = book as EpubBookLike | null | undefined;
  if (!bookCandidate) return null;
  try {
    let blob: Blob | null = null;
    if (bookCandidate.archive && typeof bookCandidate.archive.getBlob === 'function') {
      blob = await bookCandidate.archive.getBlob(audioSrc);
    } else if (typeof bookCandidate.load === 'function') {
      const data = await bookCandidate.load(audioSrc, 'blob');
      if (data instanceof Blob) {
        blob = data;
      } else if (data instanceof ArrayBuffer || data instanceof Uint8Array) {
        blob = new Blob([data as BlobPart]);
      }
    }

    if (!blob) return null;
    if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      const objectUrl = URL.createObjectURL(blob);
      return {
        url: objectUrl,
        revoke: () => {
          try {
            URL.revokeObjectURL(objectUrl);
          } catch {
            /* no-op */
          }
        },
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}
