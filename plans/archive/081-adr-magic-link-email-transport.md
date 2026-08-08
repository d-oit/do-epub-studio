# ADR-081: Magic-Link Email Transport

> **Status:** Accepted (2026-06-15)
> **Supersedes:** none
> **Related:** `analysis/SWARM_ANALYSIS.md` G15,
> `plans/076-goap-admin-recovery-and-book-crud.md` (G17 reuses
> the transport)
> **Deciders:** maintainers
> **Tags:** security, recovery, email

## Context

The reader's password recovery flow
(`apps/worker/src/routes/access.ts:15-67`) generates a magic
link token and writes the URL (with the token) to the audit
log, manually redacting the token. **No email is ever sent.**
The UI at `LoginPage.tsx:179-194` shows "A magic link has
been sent to your email" but the user receives nothing.

`worker-configuration.d.ts:460, 11289, 11366` already declares
an `EmailEvent` binding type. We need a real transport.

## Decision

We add an `EmailTransport` interface and a default
implementation that calls a Cloudflare Email Worker binding
(or, in dev, logs the email payload to a local sink).

### Interface

```ts
// apps/worker/src/lib/email-transport.ts (new)
export interface EmailTransport {
  send(message: {
    to: string;
    subject: string;
    text: string;
    html?: string;
  }): Promise<void>;
}

export class LoggingEmailTransport implements EmailTransport {
  async send(message) {
    console.log(JSON.stringify({ event: 'email.send', ...message }));
  }
}

export class EmailEventTransport implements EmailTransport {
  constructor(private binding: EmailEvent) {}
  async send(message) {
    await this.binding.send(message);
  }
}
```

### Selection

The Worker `app.ts` reads `env.EMAIL_TRANSPORT` (a binding or
`null` in dev) and constructs the appropriate transport. In
production, the binding is configured in `wrangler.jsonc`. In
dev, `LoggingEmailTransport` is used and the email is visible
in the worker log + the audit log.

### Recovery flow change

```ts
// routes/access.ts:15-67 (modified)
const recoveryUrl = `${c.env.APP_BASE_URL}/login?book=${bookSlug}&token=${token}`;
const emailTransport = getEmailTransport(c.env);
await emailTransport.send({
  to: email,
      subject: 'Recover your access to d.o.EPUB Studio',
  text: `Use this link to recover access: ${recoveryUrl}`,
});
// No audit-log entry for the raw URL; the token is not in the
// log at all. The audit log gets a 'recovery_request' event
// with the email and a SHA-256 of the token (for correlation).
await logAudit(c.env, {
  entityType: 'user',
  entityId: email,
  action: 'recovery_request',
  payload: { tokenHash: sha256Hex(token) },
});
```

### Removal of manual redaction

`recoveryUrl.replace(/token=[^&]+/, 'token=[REDACTED]')` is
deleted. The token never enters the audit log; the
`tokenHash` field is the only correlation handle.

## Consequences

### Positive

- Magic-link recovery is real.
- The audit log no longer contains a half-redacted token URL;
  the redaction cannot silently fail.
- Admin recovery (G17) reuses the same transport.

### Negative

- A new binding (`email_events`) must be configured in
  `wrangler.jsonc` for production. Documented in
  `docs/setup-local.md` and `docs/security-posture.md`.
- The transport adds one outgoing request per recovery flow.
  This is the intent.

### Neutral

- Dev mode prints emails to the worker log; existing dev
  workflow is unchanged.

## Compliance

- AGENTS.md TIER-1 — secrets (the token) are no longer in the
  audit log.
- AGENTS.md TIER-2 rule 8 — documented as a GOAP plan + ADR.
