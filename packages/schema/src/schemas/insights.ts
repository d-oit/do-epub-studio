import { z } from 'zod';

export const ReadingInsightBucketSchema = z.object({
  bookId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  activeMinutes: z.number().int().nonnegative().max(1440),
  activePages: z.number().int().nonnegative().max(10000),
  lastUpdated: z.number().int().nonnegative(),
});

export type ReadingInsightBucket = z.infer<typeof ReadingInsightBucketSchema>;

export const ReadingInsightSyncSchema = z.object({
  bookId: z.string().uuid(),
  buckets: z.array(
    z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      activeMinutes: z.number().int().nonnegative().max(1440),
      activePages: z.number().int().nonnegative().max(10000),
    }),
  ),
});

export type ReadingInsightSync = z.infer<typeof ReadingInsightSyncSchema>;

export const ReadingInsightSummarySchema = z.object({
  totalActiveMinutes: z.number().int().nonnegative(),
  totalActivePages: z.number().int().nonnegative(),
  estimatedMinutesRemaining: z.number().int().nonnegative().nullable(),
  currentStreakDays: z.number().int().nonnegative(),
  recentActivity: z.array(
    z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      activeMinutes: z.number().int().nonnegative(),
      activePages: z.number().int().nonnegative(),
    }),
  ),
});

export type ReadingInsightSummary = z.infer<typeof ReadingInsightSummarySchema>;
