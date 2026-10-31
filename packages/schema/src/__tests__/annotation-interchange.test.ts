import { describe, it, expect } from 'vitest';
import {
  ANNOTATION_INTERCHANGE_FORMAT,
  ANNOTATION_INTERCHANGE_VERSION,
  AnnotationInterchangeDocumentSchema,
  InterchangeAnnotationSchema,
  InterchangeLocatorSchema,
} from '../schemas';

describe('annotation-interchange schemas', () => {
  const validLocator = {
    cfi: 'epubcfi(/6/4[chap01]!/4/2/1:0)',
    chapterRef: 'chap01.xhtml',
    selectedText: 'Passage of text',
    prefix: 'Leading ',
    suffix: ' trailing',
    elementIndex: 1,
    charOffset: 42,
  };

  it('validates InterchangeLocatorSchema', () => {
    expect(InterchangeLocatorSchema.parse(validLocator)).toEqual(validLocator);

    // Invalid CFI format
    expect(() =>
      InterchangeLocatorSchema.parse({
        ...validLocator,
        cfi: 'not-a-cfi',
      }),
    ).toThrow();
  });

  it('validates URI schemes including http, https, and urn', () => {
    const baseAnnotation = {
      id: 'https://example.com/anno/1',
      type: 'Annotation' as const,
      motivation: 'highlighting' as const,
      created: '2026-10-31T00:00:00.000Z',
      target: {
        source: 'https://example.com/books/1',
        selector: {
          type: 'EPUBFragmentSelector' as const,
          conformsTo: 'http://www.idpf.org/epub/linking/cfi/epub-cfi.html' as const,
          value: 'epubcfi(/6/4[chap01]!/4/2/1:0)',
          locator: validLocator,
        },
      },
      body: {
        type: 'TextualBody' as const,
        value: 'Note',
        format: 'text/plain' as const,
      },
    };

    expect(InterchangeAnnotationSchema.parse(baseAnnotation)).toBeDefined();

    // URN scheme (URL parseable)
    expect(
      InterchangeAnnotationSchema.parse({
        ...baseAnnotation,
        id: 'urn:uuid:12345678-1234-1234-1234-123456789abc',
      }),
    ).toBeDefined();

    // URN scheme (triggers URL catch branch with opaque URN)
    expect(
      InterchangeAnnotationSchema.parse({
        ...baseAnnotation,
        id: 'urn:opaque:identifier',
      }),
    ).toBeDefined();

    // Disallowed scheme
    expect(() =>
      InterchangeAnnotationSchema.parse({
        ...baseAnnotation,
        id: 'javascript:alert(1)',
      }),
    ).toThrow();
  });

  it('validates extensions and JsonValue types', () => {
    const annotationWithExt = {
      id: 'urn:do-epub-studio:annotation:1',
      type: 'Annotation' as const,
      motivation: 'commenting' as const,
      target: {
        source: 'urn:do-epub-studio:publication:book-1',
        selector: {
          type: 'EPUBFragmentSelector' as const,
          conformsTo: 'http://www.idpf.org/epub/linking/cfi/epub-cfi.html' as const,
          value: 'epubcfi(/6/4[chap01]!/4/2/1:0)',
          locator: validLocator,
        },
      },
      body: {
        type: 'TextualBody' as const,
        value: 'A comment',
        purpose: 'commenting' as const,
        format: 'text/plain' as const,
      },
      extensions: {
        'https://example.org/context': {
          active: true,
          count: 5,
          nullVal: null,
          nested: ['a', 'b'],
        },
      },
    };

    expect(InterchangeAnnotationSchema.parse(annotationWithExt)).toBeDefined();

    // Non-https extension key fails
    expect(() =>
      InterchangeAnnotationSchema.parse({
        ...annotationWithExt,
        extensions: {
          'http://example.org/insecure': true,
        },
      }),
    ).toThrow();
  });

  it('validates AnnotationInterchangeDocumentSchema', () => {
    const doc = {
      format: ANNOTATION_INTERCHANGE_FORMAT,
      version: ANNOTATION_INTERCHANGE_VERSION,
      type: 'AnnotationCollection' as const,
      id: 'urn:uuid:collection-1',
      label: 'Sample Notes',
      source: 'urn:do-epub-studio:publication:book-1',
      items: [],
    };

    expect(AnnotationInterchangeDocumentSchema.parse(doc)).toEqual(doc);

    // Mismatched format or version
    expect(() =>
      AnnotationInterchangeDocumentSchema.parse({
        ...doc,
        format: 'https://example.org/other-format',
      }),
    ).toThrow();

    expect(() =>
      AnnotationInterchangeDocumentSchema.parse({
        ...doc,
        version: '2.0',
      }),
    ).toThrow();
  });
});
