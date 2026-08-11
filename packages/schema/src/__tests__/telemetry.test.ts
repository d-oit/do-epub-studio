import { describe, it, expect } from 'vitest';
import { TelemetryPayloadSchema } from '../schemas';

describe('TelemetryPayloadSchema', () => {
  it('accepts a payload without dropped (optional field)', () => {
    const result = TelemetryPayloadSchema.parse({
      logs: [{ level: 'info', traceId: 'trace-1', event: 'e' }],
    });
    expect(result.dropped).toBeUndefined();
  });

  it('accepts a nonnegative integer dropped count', () => {
    const result = TelemetryPayloadSchema.parse({
      logs: [],
      dropped: 7,
    });
    expect(result.dropped).toBe(7);
  });

  it('accepts dropped = 0', () => {
    const result = TelemetryPayloadSchema.parse({
      logs: [],
      dropped: 0,
    });
    expect(result.dropped).toBe(0);
  });

  it('rejects a negative dropped count', () => {
    expect(() => TelemetryPayloadSchema.parse({ logs: [], dropped: -1 })).toThrow();
  });

  it('rejects a non-integer dropped count', () => {
    expect(() => TelemetryPayloadSchema.parse({ logs: [], dropped: 1.5 })).toThrow();
  });
});
