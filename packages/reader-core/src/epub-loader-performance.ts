export function markLoaderPhase(perf: Performance | undefined, name: string): void {
  try {
    perf?.mark?.(name);
  } catch {
    // performance.mark unavailable — telemetry is best-effort
  }
}

export function measureLoaderPhase(
  perf: Performance | undefined,
  name: string,
  start: string,
  end: string,
): void {
  try {
    perf?.measure?.(name, start, end);
  } catch {
    // Performance measure unavailable — telemetry is best-effort
  }
}
