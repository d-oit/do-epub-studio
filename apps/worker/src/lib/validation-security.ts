/**
 * Security validation utilities for input sanitization and path traversal prevention
 */

/**
 * Validates a file key to prevent path traversal attacks
 * 
 * Security Rules:
 * - Rejects any sequence containing '..' (parent directory traversal)
 * - Rejects null bytes (%00) which can truncate strings
 * - Rejects backslashes (Windows-style paths)
 * - Only allows safe characters: alphanumeric, hyphens, underscores, dots, forward slashes
 * - Prevents absolute paths starting with '/'
 * 
 * @param fileKey - The file key to validate
 * @returns true if valid, false if malicious or malformed
 */
export function isValidFileKey(fileKey: string): boolean {
  if (!fileKey || typeof fileKey !== 'string') {
    return false;
  }

  // Reject empty strings
  if (fileKey.length === 0) {
    return false;
  }

  // Reject path traversal sequences
  if (fileKey.includes('..')) {
    return false;
  }

  // Reject null bytes (can truncate strings in some systems)
  if (fileKey.includes('\0') || fileKey.includes('%00')) {
    return false;
  }

  // Reject backslashes (Windows-style paths, can be used for evasion)
  if (fileKey.includes('\\')) {
    return false;
  }

  // Reject absolute paths
  if (fileKey.startsWith('/')) {
    return false;
  }

  // Whitelist: only allow safe characters
  // Alphanumeric, hyphens, underscores, dots, forward slashes
  const safePattern = /^[a-zA-Z0-9._/-]+$/;
  if (!safePattern.test(fileKey)) {
    return false;
  }

  // Prevent directory traversal via encoded characters
  try {
    const decoded = decodeURIComponent(fileKey);
    // Check if decoding reveals dangerous patterns
    if (decoded.includes('..') || decoded.includes('\\')) {
      return false;
    }
  } catch {
    // Invalid encoding
    return false;
  }

  return true;
}

/**
 * Validates a book ID format
 * Accepts either UUID format or slug format (alphanumeric with hyphens)
 * 
 * @param bookId - The book ID to validate
 * @returns true if valid UUID or slug format
 */
export function isValidBookId(bookId: string): boolean {
  if (!bookId || typeof bookId !== 'string') {
    return false;
  }

  // UUID pattern (8-4-4-4-12 hex digits)
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidPattern.test(bookId)) {
    return true;
  }

  // Slug pattern (lowercase alphanumeric with hyphens, 3-50 chars)
const slugPattern = /^[a-z0-9][a-z0-9-]{0,48}[a-z0-9]$/;
  if (slugPattern.test(bookId)) {
    return true;
  }

  // Single character slugs
  const singleCharPattern = /^[a-z0-9]$/;
  return singleCharPattern.test(bookId);
}

/**
 * Sanitizes an email address for storage and comparison
 * - Trims whitespace
 * - Converts to lowercase
 * - Validates basic email format
 * 
 * @param email - The email to sanitize
 * @returns Sanitized email or null if invalid
 */
export function sanitizeEmail(email: string): string | null {
  if (!email || typeof email !== 'string') {
    return null;
  }

  const trimmed = email.trim().toLowerCase();
  
  // Basic email format validation
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(trimmed)) {
    return null;
  }

  return trimmed;
}

/**
 * Validates and sanitizes a payload for audit logging
 * - Removes sensitive fields (passwords, tokens, secrets)
 * - Limits size to prevent DoS
 * - Ensures JSON-serializable
 * 
 * @param payload - The payload to sanitize
 * @param maxSize - Maximum size in bytes (default: 1024)
 * @returns Sanitized payload object
 */
export function sanitizeAuditPayload(payload: Record<string, unknown>, maxSize = 1024): Record<string, unknown> {
  if (!payload || typeof payload !== 'object') {
    return {};
  }

  // Sensitive field patterns to remove
  const sensitivePatterns = [
    /password/i,
    /secret/i,
    /token/i,
    /key(?!word)/i, // Exclude 'keyword' but catch 'apikey', 'access_key', etc.
    /auth/i,
    /credential/i,
  ];

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(payload)) {
    // Skip sensitive fields
    if (sensitivePatterns.some((pattern) => pattern.test(key))) {
      sanitized[key] = '[REDACTED]';
      continue;
    }

    // Handle nested objects recursively (with depth limit)
    if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeAuditPayload(value as Record<string, unknown>, maxSize);
      continue;
    }

    // Convert to string and check size
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value) ?? '';
    if (stringValue.length > maxSize) {
      sanitized[key] = stringValue.substring(0, maxSize) + '... [truncated]';
      continue;
    }

    sanitized[key] = value;
  }

  return sanitized;
}
