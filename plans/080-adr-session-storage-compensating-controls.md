# ADR-080: Session Storage Compensating-Controls Regression Test

> **Status:** Accepted (2026-06-15)
> **Supersedes:** none
> **Related:** ADR-092 (token storage and feature-gap policy),
> `docs/security-posture.md:34-40`,
> `analysis/SWARM_ANALYSIS.md` G23
> **Deciders:** maintainers, security reviewer
> **Tags:** governance, security-posture, ADR-092

## Context

The session token is stored in `localStorage` via Zustand
`persist`. This is **adopted** per ADR-092 and recorded in
`docs/security-posture.md:34-40`. The trade-off is explicit:
a single XSS can exfiltrate a 7-day-valid session. We retain
this design because the cookie path forces a
`SameSite=None; Secure` + CORS-credentials posture across
separate web/worker origins, and the rest of the stack is
defense-in-depth.

The risk is governance: there is **no regression test that
asserts the compensating controls are still healthy**. If
someone weakens the CSP, removes `DOMPurify` sanitization, or
adds an `eval()`, nothing in CI notices. The whole point of
the localStorage trade-off is that the other layers are tight;
without a test, that assumption is silent.

## Decision

We add a `security-posture.test.ts` (web) and a worker test
that asserts the following invariants, all derivable from
ADR-092 + the CSP and safe-regex controls:

1. `localStorage.getItem('do-epub-auth')` is the **only**
   session storage on the web app (no `sessionStorage`,
   no `IndexedDB` raw token, no `cookie` of the session).
2. The Worker's CSP **does not** include `'unsafe-eval'` in
   `script-src` (worker test fetches the response of any
   authenticated GET and asserts the header).
3. The Worker's CSP includes `report-uri /api/csp-report`
   (so reports are persisted, see G3 from the 2026-04-08
   analysis and ADR-035).
4. The CSP report route calls `logAudit(...)` (G15 of the
   2026-04-08 report — previously `console.warn` only).
5. `apps/web/src/lib/client-logger.ts` does not contain a
   function that exports the session token to telemetry.
6. `apps/worker/src/middleware/safe-regex.ts` is used at every
   `new RegExp(...)` call site (the regex audit from the
   2026-06-15 swarm found no violations, but a regression
   test prevents future drift).
7. `docs/security-posture.md` is referenced from `AGENTS.md`
   (so the trade-off is visible to every agent that reads the
   canonical rules).

### Implementation sketch

```ts
// apps/web/src/__tests__/security-posture.test.ts
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

describe('ADR-080: session storage compensating controls', () => {
  it('session token is localStorage only (not cookie, not sessionStorage)', async () => {
    const { useAuthStore } = await import('../stores/auth');
    const initial = useAuthStore.getState();
    expect(initial.sessionToken).toBeFalsy();
    useAuthStore.getState().setAuth({
      sessionToken: 't'.repeat(64),
      // ...
    });
    expect(localStorage.getItem('do-epub-auth')).toContain('"sessionToken"');
    expect(sessionStorage.getItem('do-epub-auth')).toBeNull();
    expect(document.cookie).not.toContain('sessionToken');
  });

  it('client-logger does not export sessionToken', () => {
    const src = fs.readFileSync(
      new URL('../lib/client-logger.ts', import.meta.url),
      'utf8',
    );
    expect(src).not.toMatch(/sessionToken/);
  });

  it('AGENTS.md references docs/security-posture.md', () => {
    const agents = fs.readFileSync(
      new URL('../../../../AGENTS.md', import.meta.url),
      'utf8',
    );
    expect(agents).toContain('docs/security-posture.md');
  });
});
```

```ts
// apps/worker/src/__tests__/security-posture.test.ts
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

describe('ADR-080: Worker security posture', () => {
  it('CSP excludes unsafe-eval', () => {
    const src = fs.readFileSync(
      new URL('../lib/security-headers.ts', import.meta.url),
      'utf8',
    );
    expect(src).not.toMatch(/'unsafe-eval'/);
  });

  it('CSP includes report-uri', () => {
    const src = fs.readFileSync(
      new URL('../lib/security-headers.ts', import.meta.url),
      'utf8',
    );
    expect(src).toContain('/api/csp-report');
  });

  it('CSP report route persists via logAudit', async () => {
    const src = fs.readFileSync(
      new URL('../routes/security.ts', import.meta.url),
      'utf8',
    );
    expect(src).toContain('logAudit');
  });
});
```

## Consequences

### Positive

- The ADR-092 trade-off is now load-bearing in CI.
- A future contributor cannot accidentally weaken the
  compensating controls without a red test.
- New developers reading the failure messages learn **why**
  the controls matter.

### Negative

- Adds two test files (~120 LOC). Both are deterministic and
  fast (no network, no fixtures).

### Neutral

- No runtime behavior change.

## Compliance

- AGENTS.md TIER-1 — "Tokens in HTTP-only cookie" was the
  original intent of ADR-004. ADR-092 accepts the localStorage
  trade-off. This ADR hardens the compensating controls
  per ADR-092.
- AGENTS.md TIER-2 rule 8 — documented as a GOAP plan + ADR.
