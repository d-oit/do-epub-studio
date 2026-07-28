-- Migration: 0008-telemetry-events
-- Description: Add telemetry_events table for client telemetry persistence
-- Created: 2026-07-28

-- Table for persisting client telemetry events
CREATE TABLE IF NOT EXISTS telemetry_events (
    id TEXT PRIMARY KEY,
    level TEXT NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error')),
    trace_id TEXT,
    span_id TEXT,
    event TEXT NOT NULL,
    metadata_json TEXT,
    error_json TEXT,
    received_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index for looking up telemetry by trace_id
CREATE INDEX IF NOT EXISTS idx_telemetry_events_trace_id ON telemetry_events(trace_id);

-- Index for filtering by severity level
CREATE INDEX IF NOT EXISTS idx_telemetry_events_level ON telemetry_events(level);

-- Index for time-range queries and cleanup
CREATE INDEX IF NOT EXISTS idx_telemetry_events_received_at ON telemetry_events(received_at);
