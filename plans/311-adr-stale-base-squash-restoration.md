# ADR-311: A stale-base squash that reverts other work is a repo-integrity defect, and restoring it is a defect fix

**Date:** 2026-10-06
**Status:** Accepted
**Deciders:** Project maintainer
**Related:** GOAP-311 (`plans/311-goap-restore-stale-base-reverts.md`), GOAP-1000 (`plans/1000-goap-implementation-security-e2e-feature-audit.md`), ADR-250 (atomic-commit detection), ADR-279 (commit-title enforcement), AGENTS.md Tier 1 (rebase before merge)

## Context

Two merges landed from branches cut before newer work had merged, and each
silently deleted files that other PRs had just delivered:

| Offending commit        | PR                                                           | Reverted work                                              | Paths                                                   |
| ----------------------- | ------------------------------------------------------------ | ---------------------------------------------------------- | ------------------------------------------------------- |
| `7e0cbd6c` (2026-10-04) | #1262, "prevent SPA fallback HTML on /api/* routes"          | #1264, #1273, #1274, #1275 and the creator-workspace slice | 53 deleted (31 code/test/script, 22 plan/analysis docs) |
| `46d7a98f` (2026-10-06) | #1293, "resolve production demo outage and harden DB errors" | #1287 (the telemetry-retention restoration)                | 10                                                      |

Neither message mentions the deletions. In both cases git produced a clean,
green tree — the reverted files' consumers were reverted with them — so CI, the
quality gate and review all passed while features disappeared. The A8 audit row
later had to be re-opened as **REOPENED upstream** because the artefact that
implemented it had been deleted by an unrelated squash.

The failure mode is not "a bad merge conflict resolution"; it is that the diff a
stale branch produces is _computed against its own base_, so everything merged
between that base and `main` looks like content to remove.

## Decision

1. **A merge that deletes or rewrites files it never intended to touch is a
   repo-integrity defect, not a merge detail.** It is recorded as a GOAP finding
   with the evidence chain (deleting commit ↔ adding commit ↔ path) and fixed.
2. **Merges MUST be rebased onto the then-current `main` before merging**
   (already Tier 1) — `gh pr view <n> --json mergeStateStatus` returning
   `BEHIND` is a stop sign, not a warning. Bot branches generated from an
   ancient base are the highest-risk class.
3. **Verifying a merge means listing delivered paths on `main`**, not reading
   the merge subject: `git show --stat <sha>` shows what the commit _touches_;
   `git ls-tree -r origin/main -- <path>` (or `git cat-file -e`) shows what
   _exists_. A merged PR whose paths are absent is not merged, whatever the
   checks said.
4. **Restoration is a defect fix, executed as its own PR**, with these rules:
   - restore the deleted paths **and** the consumer-side reverts the squash
     applied (a bare `git checkout <sha>^ -- <paths>` produces type errors and
     knip orphans — that is the signal, not a reason to stop);
   - use `git revert -n <offending-sha>` to recover the whole rollback, then
     **keep HEAD for every hunk that belongs to the offending commit's intended
     fix** (its routing/demo/health-check work) and for all later work;
   - when a restored file conflicts with newer behaviour, the newer behaviour
     wins and the restored _test_ is adapted to it (never the reverse);
   - the quality gate is the arbiter, and each failure names the next file to
     reconcile.
5. **Deleted plan/analysis documents are restored together with the code they
   document.** Plans 290–308 and the two analysis audits stay in the
   restoration because the restored tree cites GOAP-290–308 by number — GOAP-311
   measured 73 gate failures when they were dropped, all living citations, not
   archive. A document with no living citers may stay deleted, recorded
   explicitly in the audit trail rather than silently dropped, but
   restore-with-code is the default.

## Consequences

- The 31 restored code/test/script paths bring back: the offline annotation
  pipeline with idempotent replay (migration `0019`), the encrypted signed-URL
  cache for offline reading, locale-reload/locale-status handling, EPUB
  spine/section normalisation, creator editorial review (assist + references),
  the shared correlation-preserving log scrubber, the plan-reference validator
  and both test-helper modules (`defined()`), plus strictness parity in the app
  tsconfigs.
- Restoration is not free: it re-establishes APIs (`bookFiles` store,
  `ANNOTATION_PLAINTEXT`/`SYNC_QUEUE_PLAINTEXT`, `syncState`/`syncError`,
  `localeStatus`/`reloadRequested`) that later code had stopped using, and each
  reconnection is verified by the gate.
- The next stale-base squash is caught by the same three cheap checks: rebase
  status before merge, path listing after merge, and the audit rows that name
  the deleting commit.
- The 22 restored plan/analysis documents are kept as living citation records:
  the gate proves the restored tree still cites GOAP-290–308. `apps/web/public/_routes.json`
  — the offender's own routing fix, with no prior history — is kept at HEAD; the
  offender's seven zombie re-additions stand deleted.

## Alternatives rejected

- **Leave the reverts in place and document them** — the maintainer explicitly
  chose restoration; a green tree is not evidence a feature exists.
- **Revert the offending commit wholesale** — would also undo its intended fix
  (SPA/API routing, demo fallback, release health check) and every later change
  in the same files.
- **Re-land the original PRs by cherry-picking their merge commits** — the
  branches predate the divergence, so their diffs reintroduce the stale context
  the rollback came from.
