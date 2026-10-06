import { describe, it, expect, vi } from 'vitest';
import { queryFirst, queryAll, execute, transaction } from '../db/client';
import { AppError } from '../lib/http-errors';
import type { Env } from '../lib/env';

describe('db/client', () => {
  it('throws DB_NOT_CONFIGURED when env or env.DB is missing', async () => {
    const invalidEnv = {} as Env;

    await expect(queryFirst(invalidEnv, 'SELECT 1')).rejects.toThrow(AppError);
    await expect(queryFirst(invalidEnv, 'SELECT 1')).rejects.toHaveProperty(
      'code',
      'DB_NOT_CONFIGURED',
    );

    await expect(queryAll(invalidEnv, 'SELECT 1')).rejects.toThrow(AppError);
    await expect(execute(invalidEnv, 'SELECT 1')).rejects.toThrow(AppError);
    await expect(transaction(invalidEnv, [{ sql: 'SELECT 1' }])).rejects.toThrow(AppError);
  });

  it('executes queries against D1 when DB is configured', async () => {
    const mockPrepare = vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      all: vi.fn().mockResolvedValue({ results: [{ id: '1', title: 'Book 1' }] }),
      batch: vi.fn().mockResolvedValue([]),
    });
    const mockBatch = vi.fn().mockResolvedValue([]);

    const mockEnv = {
      DB: {
        prepare: mockPrepare,
        batch: mockBatch,
      },
    } as unknown as Env;

    const firstResult = await queryFirst(mockEnv, 'SELECT * FROM books WHERE id = ?', ['1']);
    expect(firstResult).toEqual({ id: '1', title: 'Book 1' });

    const allResult = await queryAll(mockEnv, 'SELECT * FROM books');
    expect(allResult).toEqual([{ id: '1', title: 'Book 1' }]);

    await transaction(mockEnv, [{ sql: 'DELETE FROM books WHERE id = ?', args: ['1'] }]);
    expect(mockBatch).toHaveBeenCalled();
  });
});
