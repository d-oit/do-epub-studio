import { describe, expect, it } from 'vitest';
import { LoginSchema, PaginationQuerySchema } from '../index';

describe('shared schema re-exports', () => {
  it('keeps LoginSchema exported alongside PaginationQuerySchema', () => {
    expect(LoginSchema.parse({ email: 'a@b.com', password: 'pass123' })).toEqual({
      email: 'a@b.com',
      password: 'pass123',
    });
  });

  it('PaginationQuerySchema defaults to the legacy single-page behavior', () => {
    expect(PaginationQuerySchema.parse({}).limit).toBe(1000);
    expect(PaginationQuerySchema.parse({ limit: 50, offset: 10 })).toEqual({
      limit: 50,
      offset: 10,
    });
    expect(PaginationQuerySchema.safeParse({ limit: 1001 }).success).toBe(false);
  });
});
