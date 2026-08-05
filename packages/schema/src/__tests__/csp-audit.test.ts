import { describe, it, expect } from 'vitest';
import {
  CspReportSchema,
  AuditQuerySchema,
} from '../schemas';

describe('CspReportSchema', () => {
  it('accepts valid CSP report', () => {
    const result = CspReportSchema.parse({
      'csp-report': {
        'document-uri': 'https://example.com/page',
        'violated-directive': "script-src 'self'",
      },
    });
    expect(result['csp-report']['document-uri']).toBe('https://example.com/page');
  });

  it('accepts report with optional fields', () => {
    const result = CspReportSchema.parse({
      'csp-report': {
        'document-uri': 'https://example.com',
        'referrer': 'https://google.com',
        'blocked-uri': 'https://evil.com/script.js',
        'violated-directive': "script-src 'self'",
        'effective-directive': "script-src",
        'original-policy': "script-src 'self'",
        'disposition': 'enforce',
        'status-code': 200,
        'script-sample': 'alert(1)',
      },
    });
    expect(result['csp-report']['disposition']).toBe('enforce');
  });

  it('rejects invalid document-uri', () => {
    expect(() => CspReportSchema.parse({
      'csp-report': {
        'document-uri': 'not-a-url',
        'violated-directive': "script-src 'self'",
      },
    })).toThrow();
  });
});

describe('AuditQuerySchema', () => {
  it('accepts valid query', () => {
    const result = AuditQuerySchema.parse({});
    expect(result.limit).toBe(50);
    expect(result.offset).toBe(0);
  });

  it('accepts query with string limit (coerced)', () => {
    const result = AuditQuerySchema.parse({ limit: '25' });
    expect(result.limit).toBe(25);
  });

  it('accepts query with filters', () => {
    const result = AuditQuerySchema.parse({
      entityType: 'book',
      entityId: 'b1',
      from: '2024-01-01T00:00:00.000Z',
      to: '2024-12-31T23:59:59.000Z',
    });
    expect(result.entityType).toBe('book');
  });

  it('rejects limit > 100', () => {
    expect(() => AuditQuerySchema.parse({ limit: 101 })).toThrow();
  });

  it('rejects negative offset', () => {
    expect(() => AuditQuerySchema.parse({ offset: -1 })).toThrow();
  });
});