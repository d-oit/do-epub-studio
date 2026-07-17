/**
 * Base application error with an HTTP status code and machine-readable code.
 * All domain-specific errors extend this class.
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode = 500,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/** Input validation failed (HTTP 400). */
export class ValidationError extends AppError {
  constructor(
    message: string,
    public readonly issues?: unknown[],
  ) {
    super(message, 'VALIDATION_ERROR', 400);
    this.name = 'ValidationError';
  }
}

/** Requested resource does not exist (HTTP 404). */
export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

/** Authentication required or credentials invalid (HTTP 401). */
export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401);
    this.name = 'UnauthorizedError';
  }
}

/** Authenticated but not permitted (HTTP 403). */
export class ForbiddenError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 'FORBIDDEN', 403);
    this.name = 'ForbiddenError';
  }
}

/** Resource state conflict, e.g. duplicate slug (HTTP 409). */
export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 'CONFLICT', 409);
    this.name = 'ConflictError';
  }
}

/** Too many requests — client should retry after `retryAfter` seconds (HTTP 429). */
export class RateLimitError extends AppError {
  constructor(retryAfter: number) {
    super('Too many requests', 'RATE_LIMIT', 429);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
  retryAfter: number;
}

/** Internal database or query failure (HTTP 500). */
export class DatabaseError extends AppError {
  constructor(message: string, public readonly queryContext?: string) {
    super(message, 'DATABASE_ERROR', 500);
    this.name = 'DatabaseError';
  }
}

/** Type guard: returns true if `error` is an `AppError` instance. */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Convert any error into a safe `{ code, message }` object for API responses.
 * Never leaks internal details for non-AppError values.
 */
export function toApiError(error: unknown): { code: string; message: string } {
  if (isAppError(error)) {
    return { code: error.code, message: error.message };
  }
  if (error instanceof Error) {
    return { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' };
  }
  return { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' };
}
