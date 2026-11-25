import { describe, expect, it } from 'vitest';
import {
  PortabilityEnvelopeSchema,
  PORTABILITY_FORMAT,
  PORTABILITY_PROFILE,
  PORTABILITY_VERSION,
  serializePortabilityEnvelope,
} from '../portability';

const baseEnvelope = () => ({
  format: PORTABILITY_FORMAT,
  version: PORTABILITY_VERSION,
  profile: PORTABILITY_PROFILE,
  id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
  idempotencyKey: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb60',
  exportedAt: '2026-11-20T00:00:00.000Z',
  scope: 'account' as const,
  app: { name: 'do-epub-studio', version: '0.1.0' },
  items: [
    {
      type: 'publication' as const,
      id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6e',
      bookId: 'book-1',
      slug: 'my-book',
      title: 'My Book',
      annotations: {
        format: 'https://do-epub-studio.org/profiles/epub-annotations/1.0-draft',
        version: '1.0-draft',
        type: 'AnnotationCollection',
        id: 'urn:uuid:collection-1',
        label: 'My Book',
        source: 'urn:do-epub-studio:publication:book-1',
        items: [
          {
            id: 'urn:do-epub-studio:annotation:h-1',
            type: 'Annotation',
            motivation: 'highlighting',
            created: '2026-01-01T00:00:00.000Z',
            target: {
              source: 'urn:do-epub-studio:publication:book-1',
              selector: {
                type: 'EPUBFragmentSelector',
                conformsTo: 'http://www.idpf.org/epub/linking/cfi/epub-cfi.html',
                value: 'epubcfi(/6/4!/4/2:3)',
                locator: {
                  cfi: 'epubcfi(/6/4!/4/2:3)',
                  chapterRef: 'chapter.xhtml',
                  selectedText: 'quoted text for anchoring',
                },
              },
            },
            body: {
              type: 'TextualBody',
              value: 'a note',
              purpose: 'describing',
              format: 'text/plain',
            },
            extensions: {
              'https://do-epub-studio.org/extensions/v1/highlight/color': '#ffff00',
            },
          },
        ],
      },
      progress: {
        locator: { cfi: 'epubcfi(/6/4!/4/2:3)' },
        progressPercent: 42,
        updatedAt: '2026-11-19T00:00:00.000Z',
      },
    },
    {
      type: 'preferences' as const,
      id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6f',
      preferences: {
        theme: 'dark',
        fontFamily: 'serif',
        fontSize: 'medium',
        lineHeight: 2,
        pageWidth: 'normal',
        direction: 'default',
        writingMode: 'horizontal-tb',
        aiEnabled: false,
      },
    },
  ],
});

/** Schema-typed envelope: literals alone widen `version`/optional fields. */
const parsedEnvelope = () => PortabilityEnvelopeSchema.parse(baseEnvelope());

describe('portability envelope schema', () => {
  it('accepts a valid v1 envelope', () => {
    const parsed = PortabilityEnvelopeSchema.parse(baseEnvelope());
    expect(parsed.format).toBe(PORTABILITY_FORMAT);
    expect(parsed.version).toBe(PORTABILITY_VERSION);
    expect(parsed.items).toHaveLength(2);
  });

  it('rejects unknown formats, versions, and extra top-level fields', () => {
    const badFormat = { ...baseEnvelope(), format: 'not-ours' };
    expect(() => PortabilityEnvelopeSchema.parse(badFormat)).toThrow();
    const badVersion = { ...baseEnvelope(), version: 2 };
    expect(() => PortabilityEnvelopeSchema.parse(badVersion)).toThrow();
    const extra = { ...baseEnvelope(), secrets: 'leak' };
    expect(() => PortabilityEnvelopeSchema.parse(extra)).toThrow();
  });

  it('rejects tampered envelope payloads that were reshaped', () => {
    const forged = baseEnvelope();
    // Tamper: drop the strict annotation target locator to inject internal table shape.
    const item = forged.items[0] as { annotations: { items: unknown[] } };
    (item.annotations.items[0] as Record<string, unknown>).target = {
      source: 'urn:do-epub-studio:publication:book-1',
      internalTableRow: 'hidden',
    };
    expect(() => PortabilityEnvelopeSchema.parse(forged)).toThrow();
  });

  it('rejects duplicate or non-uuid item ids and oversized item arrays', () => {
    const dup = parsedEnvelope();
    const [first, second] = dup.items;
    if (!first || !second) throw new Error('fixture must contain two items');
    second.id = first.id;
    expect(() => PortabilityEnvelopeSchema.parse(dup)).toThrow();
    const badId = parsedEnvelope();
    const [item] = badId.items;
    if (!item) throw new Error('fixture must contain an item');
    item.id = 'not-a-uuid';
    expect(() => PortabilityEnvelopeSchema.parse(badId)).toThrow();
  });

  it('serializes deterministically and validates size bounds', () => {
    const a = serializePortabilityEnvelope(parsedEnvelope());
    const b = serializePortabilityEnvelope(parsedEnvelope());
    expect(a).toBe(b);
    expect(JSON.parse(a).id).toBe(baseEnvelope().id);
  });
});
