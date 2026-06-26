import { describe, it, expect } from 'vitest';
import { clampPageSize, computeOffset, paginate } from '../dtos';

describe('pagination helpers', () => {
  it('clamps limit to default and max', () => {
    expect(clampPageSize(undefined)).toBe(24);
    expect(clampPageSize(0)).toBe(24);
    expect(clampPageSize(-5)).toBe(24);
    expect(clampPageSize(5)).toBe(5);
    expect(clampPageSize(500)).toBe(100);
    expect(clampPageSize(50, 10, 30)).toBe(30);
  });

  it('computes offset from 1-based page', () => {
    expect(computeOffset(undefined, 24)).toBe(0);
    expect(computeOffset(0, 24)).toBe(0);
    expect(computeOffset(1, 24)).toBe(0);
    expect(computeOffset(2, 24)).toBe(24);
    expect(computeOffset(3, 10)).toBe(20);
  });

  it('builds PaginatedResponse with hasMore derived from total', () => {
    const result = paginate(['a', 'b'], 50, { limit: 10, offset: 20 });
    expect(result.items).toEqual(['a', 'b']);
    expect(result.total).toBe(50);
    expect(result.pageSize).toBe(10);
    expect(result.hasMore).toBe(true);
  });

  it('marks hasMore=false on last page', () => {
    const result = paginate(['a', 'b'], 12, { limit: 10, offset: 10 });
    expect(result.hasMore).toBe(false);
  });

  it('derives page from offset when not provided', () => {
    const result = paginate([], 0, { limit: 10, offset: 30 });
    expect(result.page).toBe(4);
  });

  it('respects explicit page over offset', () => {
    const result = paginate([], 0, { limit: 10, page: 2, offset: 999 });
    expect(result.page).toBe(2);
  });
});
