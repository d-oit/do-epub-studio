import { describe, it, expect } from 'vitest';
import {
  CreateGrantSchema,
  UpdateGrantSchema,
} from '../schemas';

describe('CreateGrantSchema', () => {
  it('accepts valid grant', () => {
    const result = CreateGrantSchema.parse({
      bookId: '550e8400-e29b-41d4-a716-446655440000',
      email: 'reader@example.com',
    });
    expect(result.mode).toBe('private');
    expect(result.commentsAllowed).toBe(false);
    expect(result.offlineAllowed).toBe(false);
  });

  it('accepts grant with optional fields', () => {
    const result = CreateGrantSchema.parse({
      bookId: '550e8400-e29b-41d4-a716-446655440000',
      email: 'reader@example.com',
      password: 'password123',
      mode: 'public',
      commentsAllowed: true,
      offlineAllowed: true,
      expiresAt: '2025-12-31T23:59:59.000Z',
    });
    expect(result.mode).toBe('public');
    expect(result.commentsAllowed).toBe(true);
  });

  it('rejects invalid bookId UUID', () => {
    expect(() => CreateGrantSchema.parse({ bookId: 'not-a-uuid', email: 'a@b.com' })).toThrow();
  });

  it('rejects password shorter than 8 chars', () => {
    expect(() => CreateGrantSchema.parse({
      bookId: '550e8400-e29b-41d4-a716-446655440000',
      email: 'a@b.com',
      password: 'short',
    })).toThrow();
  });
});

describe('UpdateGrantSchema', () => {
  it('accepts partial update', () => {
    const result = UpdateGrantSchema.parse({ mode: 'public' });
    expect(result.mode).toBe('public');
  });

  it('accepts null expiresAt', () => {
    const result = UpdateGrantSchema.parse({ expiresAt: null });
    expect(result.expiresAt).toBeNull();
  });
});
