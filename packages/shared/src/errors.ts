/**
 * Base application error with a machine-readable code and HTTP status.
 *
 * All domain-specific errors extend this class, ensuring a consistent
 * error shape for API responses and client-side handling.
 *
 * @param message - Human-readable error description
 * @param code - Machine-readable error code (e.g., `'VALIDATION_ERROR'`)
 * @param statusCode - HTTP status code (default: 500)
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

/**
 * Request validation failed (HTTP 400).
 *
 * @param message - Description of the validation failure
 * @param issues - Optional array of individual validation issues (e.g., Zod issues)
 */
export class ValidationError extends AppError {
  constructor(
    message: string,
    public readonly issues?: unknown[],
  ) {
    super(message, 'VALIDATION_ERROR', 400);
    this.name = 'ValidationError';
  }
}

/**
 * The requested resource was not found (HTTP 404).
 *
 * @param resource - Name of the resource that was not found
 */
export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

/**
 * Authentication is required but was not provided or is invalid (HTTP 401).
 */
export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401);
    this.name = 'UnauthorizedError';
  }
}

/**
 * The authenticated user lacks permission for this action (HTTP 403).
 */
export class ForbiddenError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 'FORBIDDEN', 403);
    this.name = 'ForbiddenError';
  }
}

/**
 * The request conflicts with the current state of the resource (HTTP 409).
 */
export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 'CONFLICT', 409);
    this.name = 'ConflictError';
  }
}

/**
 * Rate limit has been exceeded (HTTP 429).
 */
export class RateLimitError extends AppError {
  constructor(retryAfter: number) {
    super('Too many requests', 'RATE_LIMIT', 429);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
  retryAfter: number;
}

export class DatabaseError extends AppError {
  constructor(message: string, public readonly queryContext?: string) {
    super(message, 'DATABASE_ERROR', 500);
    this.name = 'DatabaseError';
  }
}

/**
 * An operation exceeded its time budget (HTTP 504).
 *
 * Used by the parser timeout system to abort EPUB processing
 * that runs too long on malformed input.
 *
 * @param operation - Name of the timed-out operation (e.g., `'epub-sanitize'`)
 * @param timeoutMs - The timeout budget that was exceeded
 * @param traceId - Optional trace identifier for distributed tracing
 */
export class TimeoutError extends AppError {
  constructor(
    public readonly operation: string,
    public readonly timeoutMs: number,
    public readonly traceId?: string,
  ) {
    super(
      `Operation "${operation}" timed out after ${timeoutMs}ms`,
      'TIMEOUT',
      504,
    );
    this.name = 'TimeoutError';
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function toApiError(error: unknown): { code: string; message: string } {
  if (isAppError(error)) {
    return { code: error.code, message: error.message };
  }
  if (error instanceof Error) {
    return { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' };
  }
  return { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' };
}
