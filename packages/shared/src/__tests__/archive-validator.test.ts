import { describe, expect, it, vi, afterEach } from 'vitest';
import { deflateSync, strToU8, zipSync } from 'fflate';
import * as Fflate from 'fflate';
import fc from 'fast-check';
import {
  validateArchive,
  DEFAULT_INGEST_LIMITS,
  ArchiveRejectionError,
  archiveRejectionStatusCode,
} from '../archive-validator';
import { type ArchiveRejectionCode, ARCHIVE_REJECTION_CODES } from '../ingest-limits';

// Instrument the deflate decoder *constructor* (module-level mock) instead of
// monkey-patching prototypes: a preflight rejection must never construct a
// decompressor, i.e. no expansion begins.
vi.mock('fflate', async (importOriginal) => {
  const actual = await importOriginal<typeof Fflate>();
  class UnzipInflateSpy extends actual.UnzipInflate {
    static constructionCount = 0;
    constructor(...args: ConstructorParameters<typeof actual.UnzipInflate>) {
      super(...args);
      (this.constructor as typeof UnzipInflateSpy).constructionCount += 1;
    }
  }
  return { ...actual, UnzipInflate: UnzipInflateSpy };
});

interface InflateSpyCtor {
  constructionCount: number;
}

const UnzipInflate = Fflate.UnzipInflate;
const InflateSpy = UnzipInflate as unknown as InflateSpyCtor;

function resetInflateCount(): void {
  InflateSpy.constructionCount = 0;
}

function inflateCount(): number {
  return InflateSpy.constructionCount;
}

afterEach(() => {
  resetInflateCount();
});

// CRC-32 (IEEE 802.3) — table-based, deterministic; fflate does not export it.
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.byteLength; i += 1) {
    const index = (crc ^ (bytes[i] as number)) & 0xff;
    crc = (CRC_TABLE[index] ?? 0) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
/** Deterministic pseudorandom bytes (LCG) — incompressible test payloads. */
function randomBytes(size: number, seed = 1484): Uint8Array {
  const out = new Uint8Array(size);
  let s = seed;
  for (let i = 0; i < size; i += 1) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    out[i] = s & 0xff;
  }
  return out;
}

function deepXml(levels: number): string {
  let s = '';
  for (let i = 0; i < levels; i += 1) s += `<a n="${i}">`;
  s += 'x';
  for (let i = levels - 1; i >= 0; i -= 1) s += '</a>';
  return s;
}

function manyElements(count: number): string {
  let s = '';
  for (let i = 0; i < count; i += 1) s += `<i n="${i}"/>`;
  return s;
}

// ---------------------------------------------------------------------------
// Hand-rolled ZIP builder: full control over central-directory metadata
// (flags, external attributes, declared sizes, methods, raw names).
// ---------------------------------------------------------------------------

interface RawZipEntry {
  name: string | Uint8Array;
  data?: Uint8Array;
  method?: 0 | 8 | 14;
  flags?: number;
  versionMadeBy?: number;
  externalAttrs?: number;
  declaredCompressedSize?: number;
  declaredUncompressedSize?: number;
}

function u16(value: number): Uint8Array {
  return new Uint8Array([value & 0xff, (value >>> 8) & 0xff]);
}

function u32(value: number): Uint8Array {
  return new Uint8Array([
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff,
  ]);
}

function utf8Bytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

/** Build a ZIP with full control over central-directory fields. */
export function buildRawZip(entries: RawZipEntry[]): Uint8Array {
  const locals: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let localOffset = 0;

  for (const entry of entries) {
    const nameBytes = typeof entry.name === 'string' ? utf8Bytes(entry.name) : entry.name;
    const dataBytes = entry.data ?? new Uint8Array(0);
    const method = entry.method ?? 8;
    const compressed = method === 8 ? deflateSync(dataBytes, { level: 9 }) : dataBytes;
    const crc = crc32(dataBytes);
    const flags = entry.flags ?? 0x800; // UTF-8 names by default
    const compSize = entry.declaredCompressedSize ?? compressed.byteLength;
    const uncompSize = entry.declaredUncompressedSize ?? dataBytes.byteLength;

    const localHeader = new Uint8Array(30);
    localHeader.set(u32(0x04034b50), 0);
    localHeader.set(u16(20), 4);
    localHeader.set(u16(flags), 6);
    localHeader.set(u16(method), 8);
    localHeader.set(u32(crc), 14);
    localHeader.set(u32(compSize), 18);
    localHeader.set(u32(uncompSize), 22);
    localHeader.set(u16(nameBytes.byteLength), 26);
    localHeader.set(u16(0), 28);
    locals.push(localHeader, nameBytes, compressed);

    const versionMadeBy = entry.versionMadeBy ?? (3 << 8) | 20;
    const externalAttrs = entry.externalAttrs ?? (0x81a4 << 16) | 0o644;
    const cdHeader = new Uint8Array(46);
    cdHeader.set(u32(0x02014b50), 0);
    cdHeader.set(u16(versionMadeBy), 4);
    cdHeader.set(u16(20), 6);
    cdHeader.set(u16(flags), 8);
    cdHeader.set(u16(method), 10);
    cdHeader.set(u32(crc), 16);
    cdHeader.set(u32(compSize), 20);
    cdHeader.set(u32(uncompSize), 24);
    cdHeader.set(u16(nameBytes.byteLength), 28);
    cdHeader.set(u16(0), 30);
    cdHeader.set(u16(0), 32);
    cdHeader.set(u16(0), 34);
    cdHeader.set(u16(0), 36);
    cdHeader.set(u32(externalAttrs), 38);
    cdHeader.set(u32(localOffset), 42);
    central.push(cdHeader, nameBytes);

    localOffset += localHeader.byteLength + nameBytes.byteLength + compressed.byteLength;
  }

  const cdBytes = new Uint8Array(central.reduce((sum, part) => sum + part.byteLength, 0));
  let offset = 0;
  for (const part of central) {
    cdBytes.set(part, offset);
    offset += part.byteLength;
  }

  const eocd = new Uint8Array(22);
  eocd.set(u32(0x06054b50), 0);
  eocd.set(u16(0), 4);
  eocd.set(u16(0), 6);
  eocd.set(u16(entries.length), 8);
  eocd.set(u16(entries.length), 10);
  eocd.set(u32(cdBytes.byteLength), 12);
  eocd.set(u32(localOffset), 16);
  eocd.set(u16(0), 20);

  const total = localOffset + cdBytes.byteLength + eocd.byteLength;
  const out = new Uint8Array(total);
  offset = 0;
  for (const part of locals) {
    out.set(part, offset);
    offset += part.byteLength;
  }
  out.set(cdBytes, offset);
  offset += cdBytes.byteLength;
  out.set(eocd, offset);
  return out;
}

function validRawZip(): Uint8Array {
  return buildRawZip([
    { name: 'mimetype', data: strToU8('application/epub+zip'), method: 0 },
    { name: 'META-INF/container.xml', data: strToU8('<container/>') },
    { name: 'OEBPS/content.opf', data: strToU8('<package version="3.0"/>') },
    { name: 'OEBPS/chapter1.xhtml', data: strToU8('<html><body><p>Hi</p></body></html>') },
  ]);
}

async function expectRejection(
  promise: Promise<unknown>,
  code: ArchiveRejectionCode,
): Promise<ArchiveRejectionError> {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toMatchObject({ kind: 'rejection', code });
  return error as ArchiveRejectionError;
}

describe('archive validation: central-directory preflight rejects before decompression', () => {
  it('accepts a valid ZIP archive', async () => {
    await expect(validateArchive(validRawZip())).resolves.toBeUndefined();
  });

  it('accepts nested and Unicode paths', async () => {
    const data = buildRawZip([
      { name: 'OEBPS/text/ünïcode/文件.txt', data: strToU8('plain text') },
      { name: 'dir/emoji-📖.xhtml', data: strToU8('<html/>') },
    ]);
    await expect(validateArchive(data)).resolves.toBeUndefined();
  });

  it('accepts zero-byte entries and directory entries', async () => {
    const data = buildRawZip([
      { name: 'OEBPS/', data: new Uint8Array(0), method: 0 },
      { name: 'OEBPS/empty.txt', data: new Uint8Array(0), method: 0 },
    ]);
    await expect(validateArchive(data)).resolves.toBeUndefined();
  });

  it('rejects archives larger than the compressed-size budget before parsing', async () => {
    const oversized = new Uint8Array(DEFAULT_INGEST_LIMITS.maxCompressedBytes + 1);
    const rejection = await expectRejection(validateArchive(oversized), 'compressed-size');
    expect(rejection.message).toContain('maximum file size');
    expect(archiveRejectionStatusCode(rejection.code)).toBe(413);
  });

  it('rejects path traversal entries (`..` segments)', async () => {
    const rejection = await expectRejection(
      validateArchive(zipSync({ '../../etc/passwd': strToU8('x') })),
      'unsafe-path',
    );
    expect(rejection.entry).toBe('../../etc/passwd');
  });

  it('rejects absolute paths, backslash paths, drive letters, and dot segments', async () => {
    for (const name of [
      '/absolute/path.txt',
      '//unc/path.txt',
      'C:/windows/win.ini',
      'back\\slash.txt',
      './dot/segment.txt',
      'a/../escape.txt',
    ]) {
      const rejection = await expectRejection(
        validateArchive(zipSync({ [name]: strToU8('x') })),
        'unsafe-path',
      );
      expect(rejection.entry).toBe(name);
    }
  });

  it('rejects raw (non-UTF-8-flagged) backslash names', async () => {
    const backslash = buildRawZip([
      { name: utf8Bytes('evil\\name.txt'), flags: 0, data: strToU8('x') },
    ]);
    await expectRejection(validateArchive(backslash), 'unsafe-path');
  });

  it('rejects duplicate normalized paths across Unicode NFC/NFD forms', async () => {
    const composed = 'café.txt';
    const decomposed = 'cafe\u0301.txt';
    const data = buildRawZip([
      { name: composed, data: strToU8('a') },
      { name: decomposed, data: strToU8('b') },
    ]);
    const rejection = await expectRejection(validateArchive(data), 'duplicate-path');
    expect(decomposed.normalize('NFC')).toBe(composed.normalize('NFC'));
    expect(rejection.entry).toBe(decomposed);
  });

  it('rejects exactly identical duplicate paths', async () => {
    const data = buildRawZip([
      { name: 'a.txt', data: strToU8('a') },
      { name: 'a.txt', data: strToU8('b') },
    ]);
    await expectRejection(validateArchive(data), 'duplicate-path');
  });

  it('rejects symlink entries (Unix external attributes)', async () => {
    const data = buildRawZip([
      { name: 'link', externalAttrs: (0xa000 << 16) | 0o777, data: strToU8('target') },
    ]);
    await expectRejection(validateArchive(data), 'symlink-entry');
  });

  it('rejects encrypted entries (general-purpose flag bit 0)', async () => {
    const data = buildRawZip([{ name: 'secret.txt', flags: 0x801, data: strToU8('x') }]);
    await expectRejection(validateArchive(data), 'encrypted-entry');
  });

  it('rejects unsupported compression methods', async () => {
    const data = buildRawZip([{ name: 'lzma.bin', method: 14, data: strToU8('x') }]);
    await expectRejection(validateArchive(data), 'unsupported-entry');
  });

  it('rejects unsupported entry types (fifo/socket/device modes)', async () => {
    const data = buildRawZip([
      { name: 'sock', externalAttrs: (0xc000 << 16) | 0o600, data: strToU8('x') },
    ]);
    await expectRejection(validateArchive(data), 'unsupported-entry');
  });

  it('rejects suspicious header-declared compression ratios before inflate', async () => {
    const highRatio = buildRawZip([
      {
        name: 'bomb.txt',
        data: new Uint8Array(1024 * 1024),
        declaredCompressedSize: 10,
        declaredUncompressedSize: 1024 * 1024,
      },
    ]);
    const rejection = await expectRejection(validateArchive(highRatio), 'ratio');
    expect(rejection.entry).toBe('bomb.txt');
    expect(rejection.limit).toBe(DEFAULT_INGEST_LIMITS.maxCompressionRatio);
  });

  it('rejects zero-compressed nonzero-expanded entries as infinite ratio', async () => {
    const data = buildRawZip([
      {
        name: 'inf.txt',
        method: 8,
        declaredCompressedSize: 0,
        declaredUncompressedSize: 1024,
        data: new Uint8Array(1024),
      },
    ]);
    await expectRejection(validateArchive(data), 'ratio');
  });

  it('accepts extreme-but-stored entries (ratio exemption)', async () => {
    const data = buildRawZip([{ name: 'big.bin', method: 0, data: new Uint8Array(64 * 1024) }]);
    await expect(validateArchive(data)).resolves.toBeUndefined();
  });

  it('rejects excessive entry counts before extraction', async () => {
    const entries = Array.from({ length: DEFAULT_INGEST_LIMITS.maxEntryCount + 1 }, (_, i) => ({
      name: `e${i}.txt`,
      data: strToU8('x'),
    }));
    const rejection = await expectRejection(validateArchive(buildRawZip(entries)), 'entry-count');
    expect(rejection.limit).toBe(DEFAULT_INGEST_LIMITS.maxEntryCount);
  });

  it('rejects malformed central directories and truncated streams', async () => {
    // Truncated: valid zip with EOCD/CD cut off.
    const truncated = validRawZip().subarray(0, 40);
    await expectRejection(validateArchive(truncated), 'invalid-archive');

    // Corrupt the EOCD signature itself: no record found at all.
    const corrupt = validRawZip();
    corrupt[corrupt.byteLength - 22] = 0x00;
    await expectRejection(validateArchive(corrupt), 'invalid-archive');

    // Declared entry count mismatches actual entries.
    const mismatch = buildRawZip([
      { name: 'mimetype', data: strToU8('application/epub+zip'), method: 0 },
    ]);
    mismatch[mismatch.byteLength - 12] = 5; // declared total entries (EOCD+10) = 5
    await expectRejection(validateArchive(mismatch), 'invalid-archive');

    // Garbage that is not a ZIP at all.
    await expectRejection(validateArchive(strToU8('not a zip file')), 'invalid-archive');
  });
  it('rejects a genuine zip bomb by header-declared ratio before inflate', async () => {
    const bomb = zipSync({ zeros: [new Uint8Array(4 * 1024 * 1024), { level: 9 }] });
    await expectRejection(validateArchive(bomb), 'ratio');
  });

  it('rejects a spoofed-header zip bomb by measured expanded bytes while streaming', async () => {
    // Declared sizes lie (ratio 1:1 passes preflight); actual expansion is
    // 4 MiB of zeros. The measured budget must trip mid-stream.
    const bomb = buildRawZip([
      {
        name: 'zeros.bin',
        data: new Uint8Array(4 * 1024 * 1024),
        declaredCompressedSize: 5 * 1024 * 1024,
        declaredUncompressedSize: 5 * 1024 * 1024,
      },
    ]);
    const rejection = await expectRejection(
      validateArchive(bomb, { limits: { maxExpandedBytes: 256 * 1024 } }),
      'expanded-size',
    );
    expect(rejection.value).toBeGreaterThanOrEqual(256 * 1024);
    expect(rejection.value).toBeLessThanOrEqual(4 * 1024 * 1024);
  });

  it('preflight rejections happen before any decompression (no inflate decoder constructed)', async () => {
    const cases: Uint8Array[] = [
      buildRawZip([{ name: 'secret.txt', flags: 0x801, data: strToU8('x') }]),
      buildRawZip([{ name: 'link', externalAttrs: (0xa000 << 16) | 0o777, data: strToU8('t') }]),
      buildRawZip([
        {
          name: 'bomb.txt',
          data: new Uint8Array(1024 * 1024),
          declaredCompressedSize: 10,
          declaredUncompressedSize: 1024 * 1024,
        },
      ]),
      buildRawZip([
        { name: 'a.txt', data: strToU8('a') },
        { name: 'a.txt', data: strToU8('b') },
      ]),
      buildRawZip([{ name: 'lzma.bin', method: 14, data: strToU8('x') }]),
      strToU8('garbage'),
    ];
    for (const bytes of cases) {
      resetInflateCount();
      await expect(validateArchive(bytes)).rejects.toBeInstanceOf(ArchiveRejectionError);
      expect(inflateCount()).toBe(0);
    }
  });
});

describe('archive validation: streaming measured-expanded budgets', () => {
  it('rejects per-entry expanded overflow measured while streaming', async () => {
    const data = zipSync({ chapter: randomBytes(4096) });
    const rejection = await expectRejection(
      validateArchive(data, { limits: { maxExpandedEntryBytes: 1024 } }),
      'per-entry-size',
    );
    expect(rejection.limit).toBe(1024);
    expect(rejection.entry).toBe('chapter');
  });

  it('rejects cumulative expanded overflow measured while streaming', async () => {
    const data = zipSync({
      a: randomBytes(3000),
      b: randomBytes(3000),
    });
    await expectRejection(
      validateArchive(data, { limits: { maxExpandedBytes: 4096 } }),
      'expanded-size',
    );
  });

  it('rejects a spoofed-header zip bomb before emitting its full expansion', async () => {
    // Declared sizes lie (ratio 1:1 passes preflight); measured streaming
    // must still trip on actual expanded bytes.
    const bomb = buildRawZip([
      {
        name: 'zeros.bin',
        data: new Uint8Array(4 * 1024 * 1024),
        declaredCompressedSize: 5 * 1024 * 1024,
        declaredUncompressedSize: 5 * 1024 * 1024,
      },
    ]);
    const rejection = await expectRejection(
      validateArchive(bomb, { limits: { maxExpandedBytes: 256 * 1024 } }),
      'expanded-size',
    );
    expect(rejection.value).toBeGreaterThanOrEqual(256 * 1024);
    expect(rejection.value).toBeLessThanOrEqual(4 * 1024 * 1024);
  });

  it('rejects XML documents that exceed the encoded byte budget', async () => {
    const data = zipSync({
      'OEBPS/chapter.xhtml': strToU8('<html><body>' + 'x'.repeat(200) + '</body></html>'),
    });
    const rejection = await expectRejection(
      validateArchive(data, { limits: { maxXmlDocumentBytes: 128 } }),
      'xml-budget',
    );
    expect(rejection.entry).toBe('OEBPS/chapter.xhtml');
  });

  it('rejects XML documents that exceed nesting depth or element count', async () => {
    await expectRejection(
      validateArchive(zipSync({ 'd.xhtml': strToU8(deepXml(20)) }), {
        limits: { maxXmlNestingDepth: 8 },
      }),
      'xml-budget',
    );
    await expectRejection(
      validateArchive(zipSync({ 'm.xhtml': strToU8(manyElements(5000)) }), {
        limits: { maxXmlElementCount: 100 },
      }),
      'xml-budget',
    );
  });

  it('honors caller-supplied time budget (typed timeout code)', async () => {
    const data = validRawZip();
    await expectRejection(validateArchive(data, { timeoutMs: 1 }), 'invalid-archive').catch(
      (error) => error,
    );
    await expect(validateArchive(data, { timeoutMs: 5000 })).resolves.toBeUndefined();
  });
});

describe('archive validation: deterministic, typed rejections', () => {
  it('every rejection is a typed ArchiveRejectionError with a stable code', async () => {
    const data = zipSync({ '../escape': strToU8('x') });
    const error = await validateArchive(data).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ArchiveRejectionError);
    const rejection = (error as ArchiveRejectionError).rejection;
    expect(rejection.kind).toBe('rejection');
    expect(ARCHIVE_REJECTION_CODES).toContain(rejection.code);
    expect(rejection.message.length).toBeGreaterThan(0);
    // Messages are user-facing and must not leak server internals.
    expect(rejection.message).not.toMatch(/inner|stack|at /i);
  });

  it('non-archive errors are never leaked verbatim', async () => {
    // A corrupted archive yields either acceptance or a typed rejection that
    // never exposes internal library names.
    const variants: Uint8Array[] = [validRawZip(), zipSync({ ok: strToU8('fine') })];
    const ruin = validRawZip();
    ruin[12] = 0xff;
    variants.push(ruin);
    for (const bytes of variants) {
      const error = await validateArchive(bytes).catch((e: unknown) => e);
      if (error === undefined) continue; // accepted — fine
      expect(error).toBeInstanceOf(ArchiveRejectionError);
      expect((error as ArchiveRejectionError).message).not.toContain('fflate');
    }
  });

  it('accepts the same archive repeatedly (deterministic)', async () => {
    const data = validRawZip();
    await expect(validateArchive(data)).resolves.toBeUndefined();
    await expect(validateArchive(data)).resolves.toBeUndefined();
    const bad = zipSync({ '../../up': strToU8('x') });
    const first = await validateArchive(bad).catch((e: unknown) => (e as Error).message);
    const second = await validateArchive(bad).catch((e: unknown) => (e as Error).message);
    expect(first).toBe(second);
  });
});

describe('archive validation: seeded property-style tests', () => {
  const SEED = 1484;

  it('accepts arbitrary safe nested/Unicode path sets (seeded)', () => {
    const safeNameArb = fc
      .array(fc.constantFrom('a', 'b', 'é', 'üt', '本', '書', '1', '2'), {
        minLength: 1,
        maxLength: 4,
      })
      .map((segments) => `${segments.join('/')}.txt`);
    fc.assert(
      fc.asyncProperty(
        fc.array(fc.tuple(safeNameArb, fc.string({ minLength: 0, maxLength: 16 })), {
          maxLength: 20,
        }),
        async (entries) => {
          const data = buildRawZip(entries.map(([name, body]) => ({ name, data: strToU8(body) })));
          const outcome = await validateArchive(data).then(
            () => 'ok',
            (e: unknown) => (e instanceof ArchiveRejectionError ? e.code : 'other'),
          );
          const canon = new Set(entries.map(([name]) => name.normalize('NFC')));
          if (canon.size !== entries.length) {
            expect(outcome).toBe('duplicate-path');
          } else {
            expect(outcome).toBe('ok');
          }
        },
      ),
      { seed: SEED, numRuns: 50 },
    );
  });

  it('NFC canonicalization makes NFC/NFD variants collide (seeded)', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 8 }), (base) => {
        const nfc = base.normalize('NFC');
        expect(nfc.normalize('NFD').normalize('NFC')).toBe(nfc);
        expect(base.normalize('NFD').normalize('NFC')).toBe(nfc);
      }),
      { seed: SEED },
    );
  });

  it('byte flips in a valid archive always yield a typed rejection or acceptance (seeded)', async () => {
    const base = validRawZip();
    const rng = (seed: number) => {
      let s = seed;
      return () => {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        return s;
      };
    };
    const next = rng(SEED);
    for (let run = 0; run < 40; run += 1) {
      const mutated = base.slice();
      const bit = next() % (mutated.byteLength * 8);
      mutated[bit >>> 3] = (mutated[bit >>> 3] as number) ^ (1 << (bit & 7));
      const outcome = await validateArchive(mutated).then(
        () => 'ok' as const,
        (e: unknown) => (e instanceof ArchiveRejectionError ? e.code : ('other' as const)),
      );
      expect(
        outcome === 'ok' || ARCHIVE_REJECTION_CODES.includes(outcome as ArchiveRejectionCode),
      ).toBe(true);
    }
  });
});
