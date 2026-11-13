import { describe, expect, it, vi } from 'vitest';
import {
  parseSmilClock,
  normalizePublicationPath,
  parseSmilDocument,
  findActiveClip,
  extractMediaOverlays,
  resolveAudioClipUrl,
  MediaOverlayError,
  MAX_SMIL_BYTES,
} from '../media-overlay';

describe('parseSmilClock', () => {
  it('parses full clock format (hh:mm:ss[.fraction])', () => {
    expect(parseSmilClock('00:00:00')).toBe(0);
    expect(parseSmilClock('01:00:00')).toBe(3600);
    expect(parseSmilClock('01:02:03')).toBe(3723);
    expect(parseSmilClock('00:01:02.5')).toBe(62.5);
  });

  it('parses partial clock format (mm:ss[.fraction])', () => {
    expect(parseSmilClock('00:00')).toBe(0);
    expect(parseSmilClock('02:03')).toBe(123);
    expect(parseSmilClock('00:10.5')).toBe(10.5);
  });

  it('parses timecount with units (s, ms, min, h, and bare numbers)', () => {
    expect(parseSmilClock('0s')).toBe(0);
    expect(parseSmilClock('12.5s')).toBe(12.5);
    expect(parseSmilClock('250ms')).toBe(0.25);
    expect(parseSmilClock('1.5min')).toBe(90);
    expect(parseSmilClock('2h')).toBe(7200);
    expect(parseSmilClock('15')).toBe(15);
    expect(parseSmilClock('  15.5  ')).toBe(15.5);
  });

  it('returns 0 for empty or whitespace or null/undefined inputs', () => {
    expect(parseSmilClock('')).toBe(0);
    expect(parseSmilClock('   ')).toBe(0);
    expect(parseSmilClock(null)).toBe(0);
    expect(parseSmilClock(undefined)).toBe(0);
  });

  it('rejects negative clock values', () => {
    expect(() => parseSmilClock('-5s')).toThrow(MediaOverlayError);
    expect(() => parseSmilClock('-01:00')).toThrow(MediaOverlayError);
  });

  it('rejects invalid or malformed clock values', () => {
    expect(() => parseSmilClock('invalid')).toThrow(MediaOverlayError);
    expect(() => parseSmilClock('1:2:3:4')).toThrow(MediaOverlayError);
    expect(() => parseSmilClock('00:65:00')).toThrow(MediaOverlayError);
    expect(() => parseSmilClock('00:00:75')).toThrow(MediaOverlayError);
    expect(() => parseSmilClock('123foo')).toThrow(MediaOverlayError);
  });
});

describe('normalizePublicationPath', () => {
  it('resolves relative publication paths cleanly', () => {
    expect(normalizePublicationPath('OEBPS', 'chapter.xhtml')).toBe('OEBPS/chapter.xhtml');
    expect(normalizePublicationPath('OEBPS/smil', '../chapter.xhtml#line')).toBe(
      'OEBPS/chapter.xhtml#line',
    );
    expect(normalizePublicationPath('', 'audio/narration.mp3')).toBe('audio/narration.mp3');
    expect(normalizePublicationPath('OEBPS', './audio/narration.mp3')).toBe(
      'OEBPS/audio/narration.mp3',
    );
  });

  it('rejects empty paths', () => {
    expect(() => normalizePublicationPath('OEBPS', '')).toThrow(MediaOverlayError);
    expect(() => normalizePublicationPath('OEBPS', '   ')).toThrow(MediaOverlayError);
  });

  it('rejects remote protocols and schemes', () => {
    expect(() => normalizePublicationPath('OEBPS', 'https://example.com/audio.mp3')).toThrow(
      MediaOverlayError,
    );
    expect(() => normalizePublicationPath('OEBPS', 'http://example.com/audio.mp3')).toThrow(
      MediaOverlayError,
    );
    expect(() => normalizePublicationPath('OEBPS', '//example.com/audio.mp3')).toThrow(
      MediaOverlayError,
    );
    expect(() => normalizePublicationPath('OEBPS', 'ftp://example.com/audio.mp3')).toThrow(
      MediaOverlayError,
    );
    expect(() => normalizePublicationPath('OEBPS', 'data:audio/mp3;base64,...')).toThrow(
      MediaOverlayError,
    );
  });

  it('rejects absolute Windows drive letters', () => {
    expect(() => normalizePublicationPath('OEBPS', 'C:\\audio\\narration.mp3')).toThrow(
      MediaOverlayError,
    );
  });

  it('rejects directory traversal escaping archive root', () => {
    expect(() => normalizePublicationPath('OEBPS', '../../outside.mp3')).toThrow(MediaOverlayError);
    expect(() => normalizePublicationPath('', '../outside.mp3')).toThrow(MediaOverlayError);
  });
});

describe('parseSmilDocument', () => {
  const validSmil = `<?xml version="1.0" encoding="UTF-8"?>
<smil xmlns="http://www.w3.org/ns/SMIL" version="3.0">
  <body>
    <seq id="seq1" epub:textref="chapter.xhtml">
      <par id="par1">
        <text src="chapter.xhtml#p1"/>
        <audio src="audio/narration.mp3" clipBegin="0s" clipEnd="4.5s"/>
      </par>
      <par id="par2">
        <text src="chapter.xhtml#p2"/>
        <audio src="audio/narration.mp3" clipBegin="4.5s" clipEnd="10.2s"/>
      </par>
    </seq>
  </body>
</smil>`;

  it('parses a valid SMIL document into a MediaOverlaySequence', () => {
    const seq = parseSmilDocument(validSmil, 'OEBPS/overlay.smil');
    expect(seq.id).toBe('seq1');
    expect(seq.textRef).toBe('OEBPS/chapter.xhtml');
    expect(seq.smilPath).toBe('OEBPS/overlay.smil');
    expect(seq.clips).toHaveLength(2);
    expect(seq.totalDuration).toBe(10.2);

    expect(seq.clips[0]).toEqual({
      id: 'par1',
      textHref: 'OEBPS/chapter.xhtml#p1',
      elementId: 'p1',
      audioSrc: 'OEBPS/audio/narration.mp3',
      clipBegin: 0,
      clipEnd: 4.5,
      duration: 4.5,
    });

    expect(seq.clips[1]).toEqual({
      id: 'par2',
      textHref: 'OEBPS/chapter.xhtml#p2',
      elementId: 'p2',
      audioSrc: 'OEBPS/audio/narration.mp3',
      clipBegin: 4.5,
      clipEnd: 10.2,
      duration: 5.7,
    });
  });

  it('rejects empty or oversized SMIL document', () => {
    expect(() => parseSmilDocument('', 'test.smil')).toThrow(MediaOverlayError);
    const oversized = 'a'.repeat(MAX_SMIL_BYTES + 1);
    expect(() => parseSmilDocument(oversized, 'test.smil')).toThrow(MediaOverlayError);
  });

  it('rejects clip when clipEnd is less than clipBegin', () => {
    const invalidTimes = `<smil xmlns="http://www.w3.org/ns/SMIL">
      <body>
        <seq>
          <par><text src="c.xhtml#p1"/><audio src="a.mp3" clipBegin="10s" clipEnd="5s"/></par>
        </seq>
      </body>
    </smil>`;
    expect(() => parseSmilDocument(invalidTimes, 'test.smil')).toThrow(MediaOverlayError);
  });

  it('enforces maximum clips per sequence', () => {
    const manyPars = Array.from(
      { length: 5 },
      (_, i) =>
        `<par><text src="c.xhtml#p${i}"/><audio src="a.mp3" clipBegin="${i}s" clipEnd="${i + 1}s"/></par>`,
    ).join('\n');
    const smil = `<smil xmlns="http://www.w3.org/ns/SMIL"><body><seq>${manyPars}</seq></body></smil>`;

    expect(() => parseSmilDocument(smil, 'test.smil', { maxClips: 3 })).toThrow(MediaOverlayError);
  });

  it('enforces maximum clip duration limit', () => {
    const longClip = `<smil xmlns="http://www.w3.org/ns/SMIL">
      <body>
        <seq>
          <par><text src="c.xhtml#p1"/><audio src="a.mp3" clipBegin="0s" clipEnd="500s"/></par>
        </seq>
      </body>
    </smil>`;
    expect(() => parseSmilDocument(longClip, 'test.smil', { maxDuration: 100 })).toThrow(
      MediaOverlayError,
    );
  });
});

describe('findActiveClip', () => {
  const sequence = {
    smilPath: 'OEBPS/overlay.smil',
    totalDuration: 10,
    clips: [
      {
        id: 'c1',
        textHref: 'c.xhtml#p1',
        elementId: 'p1',
        audioSrc: 'a.mp3',
        clipBegin: 0,
        clipEnd: 3,
        duration: 3,
      },
      {
        id: 'c2',
        textHref: 'c.xhtml#p2',
        elementId: 'p2',
        audioSrc: 'a.mp3',
        clipBegin: 3,
        clipEnd: 7.5,
        duration: 4.5,
      },
    ],
  };

  it('finds the active clip matching currentTime', () => {
    expect(findActiveClip(sequence, 0)?.id).toBe('c1');
    expect(findActiveClip(sequence, 1.5)?.id).toBe('c1');
    expect(findActiveClip(sequence, 3)?.id).toBe('c2');
    expect(findActiveClip(sequence, 7.4)?.id).toBe('c2');
  });

  it('returns null when time is out of bounds or clips empty', () => {
    expect(findActiveClip(sequence, -1)).toBeNull();
    expect(findActiveClip(sequence, 7.5)).toBeNull();
    expect(findActiveClip(sequence, 20)).toBeNull();
    expect(findActiveClip({ ...sequence, clips: [] }, 1)).toBeNull();
  });
});

describe('extractMediaOverlays', () => {
  it('extracts media overlays from book manifest', async () => {
    const smilContent = `<smil xmlns="http://www.w3.org/ns/SMIL">
      <body>
        <seq epub:textref="chapter.xhtml">
          <par><text src="chapter.xhtml#line"/><audio src="audio.mp3" clipBegin="0s" clipEnd="2s"/></par>
        </seq>
      </body>
    </smil>`;

    const mockBook = {
      package: {
        manifest: {
          chap1: {
            id: 'chap1',
            href: 'OEBPS/chapter.xhtml',
            'media-type': 'application/xhtml+xml',
            'media-overlay': 'smil1',
          },
          smil1: {
            id: 'smil1',
            href: 'OEBPS/overlay.smil',
            'media-type': 'application/smil+xml',
          },
        },
      },
      archive: {
        getText: vi.fn().mockResolvedValue(smilContent),
      },
    };

    const manifest = await extractMediaOverlays(mockBook);
    expect(manifest.hasMediaOverlays).toBe(true);
    expect(manifest.totalDuration).toBe(2);
    expect(manifest.sequencesByChapter['OEBPS/chapter.xhtml']).toBeDefined();
    expect(manifest.sequencesByChapter['chapter.xhtml']).toBeDefined();
  });

  it('returns empty manifest if book has no media overlays', async () => {
    const mockBook = {
      package: {
        manifest: {
          chap1: { id: 'chap1', href: 'chapter.xhtml' },
        },
      },
    };
    const manifest = await extractMediaOverlays(mockBook);
    expect(manifest.hasMediaOverlays).toBe(false);
    expect(manifest.totalDuration).toBe(0);
  });
});

describe('resolveAudioClipUrl', () => {
  it('resolves blob and creates revocable object URL', async () => {
    const fakeBlob = new Blob(['audio data'], { type: 'audio/mpeg' });
    const mockBook = {
      archive: {
        getBlob: vi.fn().mockResolvedValue(fakeBlob),
      },
    };

    const origCreate = URL.createObjectURL.bind(URL);
    const origRevoke = URL.revokeObjectURL.bind(URL);
    const revokeSpy = vi.fn();
    URL.createObjectURL = vi.fn().mockReturnValue('blob:http://localhost/test');
    URL.revokeObjectURL = revokeSpy;
    try {
      const result = await resolveAudioClipUrl(mockBook, 'OEBPS/audio.mp3');
      expect(result).not.toBeNull();
      expect(result?.url).toContain('blob:');
      result?.revoke();
      expect(revokeSpy).toHaveBeenCalledWith('blob:http://localhost/test');
    } finally {
      URL.createObjectURL = origCreate;
      URL.revokeObjectURL = origRevoke;
    }
  });

  it('returns null when asset is missing or throws', async () => {
    const mockBook = {
      archive: {
        getBlob: vi.fn().mockRejectedValue(new Error('not found')),
      },
    };
    const result = await resolveAudioClipUrl(mockBook, 'missing.mp3');
    expect(result).toBeNull();
  });
});
