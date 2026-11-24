/**
 * Shared request parsing, response mapping, and timestamp helpers for the
 * in-memory offline sync server.
 */
import type { ServerCommentRow, ServerHighlightRow, ServerProgressRow } from './types';

/** Validated reads from an untrusted request body (JSON boundary). */
export function str(obj: Record<string, unknown> | null, key: string): string | undefined {
  if (!obj) return undefined;
  const value = obj[key];
  return typeof value === 'string' ? value : undefined;
}

export function num(obj: Record<string, unknown> | null, key: string): number | undefined {
  if (!obj) return undefined;
  const value = obj[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function cfiLocator(obj: Record<string, unknown> | null): { cfi: string } | null {
  if (!obj) return null;
  const value = obj.locator;
  if (typeof value !== 'object' || value === null) return null;
  const cfi = (value as Record<string, unknown>).cfi;
  return typeof cfi === 'string' ? { cfi } : null;
}

export function errorBody(message: string, code: string): Record<string, unknown> {
  return { ok: false, error: { message, code } };
}

export function sleepNow(): string {
  return new Date().toISOString();
}

export function progressData(row: ServerProgressRow): Record<string, unknown> {
  return {
    locator: row.locator,
    progressPercent: row.progressPercent,
    updatedAt: row.updatedAt,
    revision: row.revision,
  };
}

export function toHighlightDto(row: ServerHighlightRow): Record<string, unknown> {
  return {
    id: row.id,
    chapterRef: row.chapterRef,
    cfiRange: row.cfiRange,
    selectedText: row.selectedText,
    note: row.note,
    color: row.color,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    anchorStatus: 'anchored',
    confidence: 1.0,
    migrationOutcome: null,
    revisionId: null,
    originalCfi: null,
    originalChapterRef: null,
    originalSelectedText: null,
  };
}

export function toCommentDto(row: ServerCommentRow): Record<string, unknown> {
  return {
    id: row.id,
    displayName: 're***',
    isOwn: true,
    chapterRef: row.chapterRef,
    cfiRange: row.cfiRange,
    selectedText: row.selectedText,
    body: row.body,
    visibility: row.visibility,
    status: row.status,
    parentCommentId: row.parentCommentId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    resolvedAt: row.resolvedAt,
    anchorStatus: 'anchored',
    confidence: 1.0,
    migrationOutcome: null,
    revisionId: null,
    originalCfi: null,
    originalChapterRef: null,
    originalSelectedText: null,
  };
}
