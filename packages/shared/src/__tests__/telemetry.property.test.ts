import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  serializeError,
  createTraceId,
  createSpanId,
  TRACE_HEADER,
  SPAN_HEADER,
  LOCALE_HEADER,
  type SerializedError,
} from '../telemetry';

describe('serializeError with Error objects', () => {
  it('preserves name and message', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.string({ minLength: 0, maxLength: 200 }),
        fc.constantFrom('Error', 'TypeError', 'RangeError', 'SyntaxError', 'CustomError'),
        (message, stack, name) => {
          const error = new Error(message);
          error.name = name;
          if (stack) error.stack = stack;
          const serialized = serializeError(error);
          expect(serialized.name).toBe(name);
          expect(serialized.message).toBe(message);
        },
      ),
    );
  });

  it('includes stack when present', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.oneof(fc.string(), fc.constant(undefined)),
        (message, stack) => {
          const error = new Error(message);
          if (stack !== undefined) {
            error.stack = stack;
          }
          const serialized = serializeError(error);
          if (stack !== undefined && error.stack) {
            expect(serialized.stack).toBe(error.stack);
          }
        },
      ),
    );
  });

  it('handles nested Error causes', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.string(),
        (outerMessage, innerMessage) => {
          const inner = new Error(innerMessage);
          const outer = new Error(outerMessage, { cause: inner });
          const serialized = serializeError(outer);
          expect(serialized.name).toBe('Error');
          expect(serialized.message).toBe(outerMessage);
          expect(serialized.cause).toBeDefined();
        },
      ),
    );
  });

  it('handles string cause', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.string(),
        (message, causeMsg) => {
          const error = new Error(message, { cause: causeMsg });
          const serialized = serializeError(error);
          expect(serialized.cause).toBe(causeMsg);
        },
      ),
    );
  });
});

describe('serializeError with non-Error inputs', () => {
  it('handles string input', () => {
    fc.assert(
      fc.property(fc.string(), (message) => {
        const serialized = serializeError(message);
        expect(serialized).toEqual({ name: 'Error', message });
      }),
    );
  });

  it('handles object input', () => {
    fc.assert(
      fc.property(fc.object(), (obj) => {
        const serialized = serializeError(obj);
        expect(typeof serialized.name).toBe('string');
        expect(typeof serialized.message).toBe('string');
      }),
    );
  });

  it('handles primitive inputs without throwing', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.integer(), fc.boolean(), fc.constant(null), fc.constant(undefined)),
        (value) => {
          expect(() => serializeError(value)).not.toThrow();
          const serialized = serializeError(value);
          expect(serialized.name).toBe('Error');
          expect(typeof serialized.message).toBe('string');
        },
      ),
    );
  });

  it('preserves custom name from object', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (customName) => {
        const obj = { name: customName, message: 'something broke' };
        const serialized = serializeError(obj);
        expect(serialized.name).toBe(customName);
      }),
    );
  });
});

describe('serializeError output structure', () => {
  it('serialized output survives JSON round-trip', () => {
    fc.assert(
      fc.property(fc.string(), fc.oneof(fc.string(), fc.constant(undefined)), (message, stack) => {
        const error = new Error(message);
        if (stack !== undefined) error.stack = stack;
        const serialized = serializeError(error);
        const parsed: SerializedError = JSON.parse(JSON.stringify(serialized));
        expect(parsed.name).toBe(serialized.name);
        expect(parsed.message).toBe(serialized.message);
      }),
    );
  });

  it('never contains undefined values in output', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.string(),
          fc.integer(),
          fc.boolean(),
          fc.object(),
          fc.constant(null),
          fc.constant(undefined),
        ),
        (value) => {
          const serialized = serializeError(value);
          const json = JSON.parse(JSON.stringify(serialized));
          expect(Object.values(json).every((v) => v !== undefined)).toBe(true);
        },
      ),
    );
  });
});

describe('createTraceId', () => {
  it('returns a non-empty string', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100 }), () => {
        const traceId = createTraceId();
        expect(typeof traceId).toBe('string');
        expect(traceId.length).toBeGreaterThan(0);
      }),
    );
  });

  it('returns unique values on successive calls', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(createTraceId());
    }
    expect(ids.size).toBe(100);
  });
});

describe('createSpanId', () => {
  it('returns a non-empty string', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100 }), () => {
        const spanId = createSpanId();
        expect(typeof spanId).toBe('string');
        expect(spanId.length).toBeGreaterThan(0);
      }),
    );
  });

  it('does not collide in 100 successive calls', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(createSpanId());
    }
    expect(ids.size).toBe(100);
  });
});

describe('telemetry constants', () => {
  it('header constants are non-empty strings', () => {
    expect(typeof TRACE_HEADER).toBe('string');
    expect(TRACE_HEADER.length).toBeGreaterThan(0);
    expect(typeof SPAN_HEADER).toBe('string');
    expect(SPAN_HEADER.length).toBeGreaterThan(0);
    expect(typeof LOCALE_HEADER).toBe('string');
    expect(LOCALE_HEADER.length).toBeGreaterThan(0);
  });
});
