import { describe, it, expect } from 'vitest';
import {
  AccessRequestSchema,
  RecoveryRequestSchema,
  RecoveryVerifySchema,
} from '../schemas';

describe('AccessRequestSchema', () => {
  it('accepts valid request', () => {
    const result = AccessRequestSchema.parse({ bookSlug: 'my-book', email: 'a@b.com' });
    expect(result.bookSlug).toBe('my-book');
    expect(result.email).toBe('a@b.com');
  });

  it('accepts request with password', () => {
    const result = AccessRequestSchema.parse({ bookSlug: 'book', email: 'a@b.com', password: 'pass123' });
    expect(result.password).toBe('pass123');
  });

  it('rejects invalid email', () => {
    expect(() => AccessRequestSchema.parse({ bookSlug: 'book', email: 'not-an-email' })).toThrow();
  });

  it('accepts empty bookSlug', () => {
    const result = AccessRequestSchema.parse({ bookSlug: '', email: 'a@b.com' });
    expect(result.bookSlug).toBe('');
  });
});

describe('RecoveryRequestSchema', () => {
  it('accepts valid request', () => {
    const result = RecoveryRequestSchema.parse({ bookSlug: 'book', email: 'a@b.com' });
    expect(result.bookSlug).toBe('book');
  });
});

describe('RecoveryVerifySchema', () => {
  it('accepts valid token', () => {
    const result = RecoveryVerifySchema.parse({ token: 'abc123' });
    expect(result.token).toBe('abc123');
  });

  it('rejects empty token', () => {
    expect(() => RecoveryVerifySchema.parse({ token: '' })).toThrow();
  });
});
