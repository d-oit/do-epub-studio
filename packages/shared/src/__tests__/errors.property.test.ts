import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  RateLimitError,
  isAppError,
  toApiError,
} from '../errors';

const nonEmptyString = fc.string({ minLength: 1, maxLength: 200 });
const anyString = fc.string();
const statusCode = fc.integer({ min: 100, max: 599 });
const errorCode = fc.constantFrom(
  'VALIDATION_ERROR',
  'NOT_FOUND',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'CONFLICT',
  'RATE_LIMIT',
  'INTERNAL_ERROR',
  'CUSTOM_ERROR',
);

describe('AppError creation', () => {
  it('preserves message and code for any valid input', () => {
    fc.assert(
      fc.property(anyString, errorCode, statusCode, (message, code, status) => {
        const error = new AppError(message, code, status);
        expect(error.message).toBe(message);
        expect(error.code).toBe(code);
        expect(error.statusCode).toBe(status);
        expect(error.name).toBe('AppError');
      }),
    );
  });

  it('handles edge case strings', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('', '   ', '\n\t', 'hello\u0000world', 'a'.repeat(10000), '\x00\x01\x02'),
        errorCode,
        (message, code) => {
          const error = new AppError(message, code);
          expect(error.message).toBe(message);
          expect(error instanceof Error).toBe(true);
        },
      ),
    );
  });

  it('handles unicode and special characters in message', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        (message) => {
          const error = new AppError(message, 'UNICODE_TEST', 418);
          expect(error.message).toBe(message);
          expect(error.code).toBe('UNICODE_TEST');
        },
      ),
    );
  });
});

describe('isAppError type guard', () => {
  it('returns true for all AppError subclasses', () => {
    fc.assert(
      fc.property(
        anyString,
        fc.constantFrom(
          'AppError',
          'ValidationError',
          'NotFoundError',
          'UnauthorizedError',
          'ForbiddenError',
          'ConflictError',
        ),
        (message, errorType) => {
          const error = createTypedError(message, errorType);
          expect(isAppError(error)).toBe(true);
        },
      ),
    );
  });

  it('returns false for non-AppError values', () => {
    fc.assert(
      fc.property(
        fc.anything(),
        (value) => {
          if (value instanceof AppError) {
            return;
          }
          expect(isAppError(value)).toBe(false);
        },
      ),
    );
  });
});

function createTypedError(message: string, type: string): AppError {
  switch (type) {
    case 'ValidationError':
      return new ValidationError(message);
    case 'NotFoundError':
      return new NotFoundError(message);
    case 'UnauthorizedError':
      return new UnauthorizedError(message);
    case 'ForbiddenError':
      return new ForbiddenError(message);
    case 'ConflictError':
      return new ConflictError(message);
    default:
      return new AppError(message, 'TEST', 500);
  }
}

describe('toApiError conversion', () => {
  it('returns correct structure for AppError instances', () => {
    fc.assert(
      fc.property(anyString, errorCode, statusCode, (message, code, status) => {
        const error = new AppError(message, code, status);
        const apiError = toApiError(error);
        expect(apiError).toEqual({ code, message });
      }),
    );
  });

  it('returns INTERNAL_ERROR for non-AppError Error instances', () => {
    fc.assert(
      fc.property(anyString, (message) => {
        const error = new Error(message);
        const apiError = toApiError(error);
        expect(apiError).toEqual({ code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' });
      }),
    );
  });

  it('returns INTERNAL_ERROR for non-Error values', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.integer(), fc.boolean(), fc.constant(null), fc.constant(undefined), fc.object()),
        (value) => {
          const apiError = toApiError(value);
          expect(apiError).toEqual({ code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' });
        },
      ),
    );
  });

  it('handles string values as non-Error', () => {
    fc.assert(
      fc.property(anyString, (value) => {
        const apiError = toApiError(value);
        expect(apiError.code).toBe('INTERNAL_ERROR');
      }),
    );
  });
});

describe('ValidationError specific behavior', () => {
  it('carries optional issues array', () => {
    fc.assert(
      fc.property(
        anyString,
        fc.option(fc.array(fc.object()), { nil: undefined }),
        (message, issues) => {
          const error = new ValidationError(message, issues);
          expect(error.code).toBe('VALIDATION_ERROR');
          expect(error.statusCode).toBe(400);
          expect(error.issues).toBe(issues);
        },
      ),
    );
  });
});

describe('RateLimitError specific behavior', () => {
  it('stores retryAfter', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 3600 }),
        (retryAfter) => {
          const error = new RateLimitError(retryAfter);
          expect(error.retryAfter).toBe(retryAfter);
          expect(error.code).toBe('RATE_LIMIT');
          expect(error.statusCode).toBe(429);
          expect(error.message).toBe('Too many requests');
        },
      ),
    );
  });
});

describe('NotFoundError message format', () => {
  it('formats message as "{resource} not found"', () => {
    fc.assert(
      fc.property(nonEmptyString, (resource) => {
        const error = new NotFoundError(resource);
        expect(error.message).toBe(`${resource} not found`);
        expect(error.code).toBe('NOT_FOUND');
        expect(error.statusCode).toBe(404);
      }),
    );
  });
});

describe('UnauthorizedError default message', () => {
  it('uses default message when not provided', () => {
    const error = new UnauthorizedError();
    expect(error.message).toBe('Unauthorized');
    expect(error.code).toBe('UNAUTHORIZED');
    expect(error.statusCode).toBe(401);
  });
});

describe('ForbiddenError default message', () => {
  it('uses default message when not provided', () => {
    const error = new ForbiddenError();
    expect(error.message).toBe('Access denied');
    expect(error.code).toBe('FORBIDDEN');
    expect(error.statusCode).toBe(403);
  });
});
