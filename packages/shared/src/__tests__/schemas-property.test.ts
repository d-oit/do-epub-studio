import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { MultiSignalLocatorSchema } from '../schemas';

describe('MultiSignalLocatorSchema (property)', () => {
  it('accepts any valid combination of non-empty strings', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.string({ minLength: 1, maxLength: 200 }),
        (cfi, selectedText, chapterRef) => {
          const result = MultiSignalLocatorSchema.safeParse({ cfi, selectedText, chapterRef });
          expect(result.success).toBe(true);
          if (result.success) {
            expect(result.data.cfi).toBe(cfi);
            expect(result.data.selectedText).toBe(selectedText);
            expect(result.data.chapterRef).toBe(chapterRef);
          }
        },
      ),
    );
  });

  it('rejects input missing any required field', () => {
    fc.assert(
      fc.property(
        fc.option(fc.string({ minLength: 1 }), { nil: undefined }),
        fc.option(fc.string({ minLength: 1 }), { nil: undefined }),
        fc.option(fc.string({ minLength: 1 }), { nil: undefined }),
        (cfi, selectedText, chapterRef) => {
          const input: Record<string, string> = {};
          if (cfi !== undefined) input.cfi = cfi;
          if (selectedText !== undefined) input.selectedText = selectedText;
          if (chapterRef !== undefined) input.chapterRef = chapterRef;
          if (cfi === undefined || selectedText === undefined || chapterRef === undefined) {
            const result = MultiSignalLocatorSchema.safeParse(input);
            expect(result.success).toBe(false);
          }
        },
      ),
    );
  });

  it('rejects input with extra unknown keys', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        fc.string(),
        (cfi, selectedText, chapterRef, extraKey) => {
          fc.pre(
            extraKey.length > 0 &&
              extraKey !== 'cfi' &&
              extraKey !== 'selectedText' &&
              extraKey !== 'chapterRef',
          );
          fc.pre(extraKey !== '__proto__');
          const result = MultiSignalLocatorSchema.safeParse({
            cfi,
            selectedText,
            chapterRef,
            [extraKey]: 'some value',
          });
          expect(result.success).toBe(false);
        },
      ),
    );
  });

  it('rejects empty string for any required field', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('cfi', 'selectedText', 'chapterRef'),
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.string({ minLength: 1, maxLength: 100 }),
        (emptyField, a, b) => {
          const input: Record<string, string> = {};
          input[emptyField] = '';
          if (emptyField !== 'cfi') input.cfi = a;
          if (emptyField !== 'selectedText') input.selectedText = a;
          if (emptyField !== 'chapterRef') input.chapterRef = b;
          const result = MultiSignalLocatorSchema.safeParse(input);
          expect(result.success).toBe(false);
        },
      ),
    );
  });
});
