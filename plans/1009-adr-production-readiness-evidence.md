# ADR-1009: Production-readiness audit evidence and safety boundary

**Status:** Accepted for this audit
**Date:** 2026-10-18
**Deciders:** Project maintainer
**Applies to:** `plans/1009-goap-production-readiness-audit.md` and findings assigned by that audit
**ADRs referenced:** ADR-1000 (audit evidence and execution boundaries), ADR-214 (audit recommendation governance), ADR-083 (ADR numbering)

## Context

The production-readiness audit combines source review, local execution, public deployed observations, historical records, and operational evidence that may not be accessible from this checkout. Those evidence classes are not interchangeable. The audit also covers a Pages deployment whose configured preview shares production-named D1 and KV resources; a preview label is not proof of isolation.

## Decision

1. Every audit claim is labeled `source-only`, `local-runtime`, `deployed-runtime`, `historical`, or `unverified`. Source behavior does not prove deployed configuration or user-visible runtime behavior; a mocked test does not prove a real backend journey; unavailable operator evidence is not a pass.
2. Every finding records a stable ID, requirement, source anchor, evidence class, exact command/action, expected and observed result, UTC execution time, evidence artifact, priority, responsible role, existing owner plan, and executable acceptance contract. A skipped or inaccessible check is recorded as such with its missing prerequisite and required role.
3. The public target is `https://do-epub-studio.pages.dev`, unless repository/operator evidence identifies another active target. Ordinary read-only requests and public demo-login session issuance are permitted; no other remote mutation is authorized.
4. Root `wrangler.toml` preview D1/KV bindings are treated as production resources unless isolation is proven. All migrations, seeds, invitations, revocations, recovery, admin-write probes, and delete-based retention checks use a newly-created disposable local state. Never reuse or delete the user's normal `.wrangler/state`.
5. Never print or publish passwords, tokens, signed capabilities, invitation URLs, auth state, database personal data, or unsanitized HAR. Keep redacted raw evidence under the ignored `test-results/production-readiness/<UTC-run-id>/` directory and summarize it in the report.
6. A source-confirmed defect or a deployed control gap is reported without modifying application code, deployment settings, secrets, policy, thresholds, or data. Corrective changes require separate authorization. Demonstrated vulnerabilities follow `SECURITY.md` privately; public plans contain only safe control-gap descriptions and a private tracking reference.
7. “DONE (audit only)” means every audit row has observed evidence or an explicit prerequisite blocker. It does not mean production-ready, demo-ready, certified, or free of vulnerabilities.

## Consequences

- Historical closure records remain dated and intact; current revalidation is appended as a successor note.
- Priorities order follow-up work and are not vulnerability severity ratings.
- Production-readiness and demo-working verdicts are independent and limited to the stated evidence scope.
- This ADR authorizes documentation and safe audit observations only; it authorizes no application, security-policy, or deployment change.
