import { NotFoundError, ForbiddenError, ValidationError, AppError } from '@do-epub-studio/shared';

// Re-export error classes for inline throws (TS6 control-flow requires
// inline `throw new ...` for proper null-narrowing after guards).
export { NotFoundError, ForbiddenError, ValidationError, AppError };
