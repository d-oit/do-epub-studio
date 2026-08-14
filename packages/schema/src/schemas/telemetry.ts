import { z } from 'zod';

export const TelemetryLogSchema = z.object({
  level: z.enum(['debug', 'info', 'warn', 'error']),
  traceId: z.string().max(255),
  spanId: z.string().max(255).optional(),
  event: z.string().max(1024),
  metadata: z.record(z.string(), z.unknown()).optional(),
  error: z
    .object({
      name: z.string().max(255),
      message: z.string().max(5000),
      stack: z.string().max(20000).optional(),
    })
    .optional(),
});

export type TelemetryLog = z.infer<typeof TelemetryLogSchema>;

export const TelemetryPayloadSchema = z.object({
  logs: z.array(TelemetryLogSchema).max(100),
  // Client logger's bounded buffer may drop entries when it overflows; report
  // the count so worker-side drop pressure is observable (Plan 212 O3).
  dropped: z.number().int().nonnegative().optional(),
});

export type TelemetryPayload = z.infer<typeof TelemetryPayloadSchema>;
