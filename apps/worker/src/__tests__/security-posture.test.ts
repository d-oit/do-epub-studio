import { describe, it, expect } from 'vitest';
import { securityHeaders, minimalSecurityHeaders } from '../lib/security-headers';
import fs from 'node:fs';
import path from 'node:path';

describe('Security Posture (Worker)', () => {
  it('asserts Worker CSP headers do not include unsafe-eval and include report-uri', () => {
    const csp = securityHeaders['Content-Security-Policy'];
    const scriptSrcMatch = csp?.match(/script-src ([^;]+)/);
    if (scriptSrcMatch) {
      const tokens = scriptSrcMatch[1].split(' ');
      expect(tokens).not.toContain("'unsafe-eval'");
    }
    expect(csp).toContain('report-uri /api/csp-report');

    const minimalCsp = minimalSecurityHeaders['Content-Security-Policy'];
    const minimalScriptSrcMatch = minimalCsp?.match(/script-src ([^;]+)/);
    if (minimalScriptSrcMatch) {
      const tokens = minimalScriptSrcMatch[1].split(' ');
      expect(tokens).not.toContain("'unsafe-eval'");
    }
    expect(minimalCsp).toContain('report-uri /api/csp-report');
  });

  it('asserts security router implementation calls logAudit for CSP reports', () => {
    const routerPath = path.resolve(__dirname, '../routes/security.ts');
    const content = fs.readFileSync(routerPath, 'utf-8');

    expect(content).toContain('import { logAudit } from \'../audit\'');
    expect(content).toContain('await logAudit(');
    expect(content).toContain("action: 'csp_violation'");
    expect(content).not.toContain('console.warn');
  });

  it('asserts AGENTS.md references docs/security-posture.md', () => {
    const agentsPath = path.resolve(__dirname, '../../../../AGENTS.md');
    const content = fs.readFileSync(agentsPath, 'utf-8');

    expect(content).toContain('docs/security-posture.md');
  });
});
