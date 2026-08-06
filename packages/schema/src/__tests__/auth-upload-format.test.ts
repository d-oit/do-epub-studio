import { describe, it, expect } from 'vitest';
import {
  LoginSchema,
  ValidateQuerySchema,
  SignedUrlSchema,
  UploadCompleteSchema,
  formatZodError,
} from '../schemas';

describe('LoginSchema', () => {
  it('accepts valid login', () => {
    const result = LoginSchema.parse({ email: 'a@b.com', password: 'pass123' });
    expect(result.email).toBe('a@b.com');
  });

  it('rejects empty password', () => {
    expect(() => LoginSchema.parse({ email: 'a@b.com', password: '' })).toThrow();
  });
});

describe('ValidateQuerySchema', () => {
  it('accepts valid query', () => {
    const result = ValidateQuerySchema.parse({ bookId: 'book-1' });
    expect(result.bookId).toBe('book-1');
  });
});

describe('SignedUrlSchema', () => {
  it('accepts valid signed URL', () => {
    const result = SignedUrlSchema.parse({ expires: '1234567890', signature: 'abc123' });
    expect(result.expires).toBe('1234567890');
    expect(result.signature).toBe('abc123');
  });
});

describe('UploadCompleteSchema', () => {
  it('accepts valid upload', () => {
    const result = UploadCompleteSchema.parse({
      storageKey: 'books/book-1/epub.epub',
      originalFilename: 'my-book.epub',
    });
    expect(result.storageKey).toBe('books/book-1/epub.epub');
  });

  it('accepts upload with optional fields', () => {
    const result = UploadCompleteSchema.parse({
      storageKey: 'key',
      originalFilename: 'file.epub',
      mimeType: 'application/epub+zip',
      fileSizeBytes: 1024,
      sha256: 'abc123',
      epubVersion: '3.0',
      validationResults: {
        isValid: true,
        errors: [],
        warnings: [],
      },
    });
    expect(result.fileSizeBytes).toBe(1024);
  });

  it('rejects empty storageKey', () => {
    expect(() => UploadCompleteSchema.parse({ storageKey: '', originalFilename: 'file.epub' })).toThrow();
  });
});

describe('formatZodError', () => {
  it('formats error with path', () => {
    const error = {
      issues: [
        { path: ['email'], message: 'Invalid email' },
      ],
    };
    expect(formatZodError(error)).toBe('email: Invalid email');
  });

  it('formats error without path', () => {
    const error = {
      issues: [
        { path: [], message: 'Required' },
      ],
    };
    expect(formatZodError(error)).toBe('Required');
  });

  it('formats multiple errors', () => {
    const error = {
      issues: [
        { path: ['email'], message: 'Invalid' },
        { path: ['password'], message: 'Too short' },
      ],
    };
    expect(formatZodError(error)).toBe('email: Invalid; password: Too short');
  });

  it('formats nested path', () => {
    const error = {
      issues: [
        { path: ['user', 'email'], message: 'Invalid' },
      ],
    };
    expect(formatZodError(error)).toBe('user.email: Invalid');
  });
});
