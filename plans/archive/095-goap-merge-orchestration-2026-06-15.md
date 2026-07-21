# GOAP Plan 095 — Merge Orchestration for the 2026-06-15 Swarm

**Date:** 2026-06-15
**Orchestrator:** goap-agent
**Source:** `plans/075-goap-swarm-2026-06-15.md` + `analysis/SWARM_ANALYSIS.md`
**Companion ADR:** `plans/096-adr-merge-order-policy-2026-06-15.md`
**Objective:** Land the 12 Critical/High/Medium gaps identified by the
2026-06-15 swarm (issues #531–#546) in the correct order, behind
the documented quality gates, with one PR per wave, and a clear
tracking issue for every wave.

## 1. Analysis

- **Primary Goal:** Every G14–G28 gap closes with a merged PR; CI
  is green on `main` after each wave; coverage thresholds in
  AGENTS.md hold for every package; no regression in any
  previously-closed gap.
- **Constraints:**
  - One PR per wave (atomic).
  - No PR may be merged while its wave's quality gate is red.
  - Wave A (Critical) merges first; Wave D (UX/docs) merges last.
  - Within a wave, independent slices may ship in any order.
  - Every PR must reference its companion GOAP/ADR files
    (`plans/075-…`, `plans/076-…`, …).
  - No force-push to a wave PR after review; squash is preferred.
  - Branches: `wave-a-tenant-isolation`, `wave-b-admin-reader`,
    `wave-c-centralization`, `wave-d-ux-docs`. The current
    `swarm-analysis-2026-06-15` branch holds only planning files.
- **Complexity:** Complex (12 issues, 4 waves, 4 PRs minimum).
- **Quality bar:** `./scripts/quality_gate.sh` + coverage gate +
  workflow validation + Codacy no-new-issues.

## 2. Decomposition

| Wave | Slice | Issue | Branch | Companion plan / ADR | Owner skill |
|------|-------|-------|--------|----------------------|-------------|
| A | G14 Comments IDOR | #531 | `wave-a-tenant-isolation` | 075-adr-tenant-isolation | cloudflare-worker-api + testing-strategy |
| A | G16 Locator re-validate | #533 | `wave-a-tenant-isolation` | 075-adr-tenant-isolation | cloudflare-worker-api + testing-strategy |
| A | G22 URL bookId guard | #539 | `wave-a-tenant-isolation` | 075-adr-tenant-isolation | cloudflare-worker-api + testing-strategy |
| B | G15 Magic-link email | #532 | `wave-b-admin-reader` | 081-adr-magic-link-email-transport | cloudflare-worker-api |
| B | G17 Admin recovery | #534 | `wave-b-admin-reader` | 076-goap-admin-recovery-and-book-crud | cloudflare-worker-api + reader-ui-ux |
| B | G18 Book edit/delete | #535 | `wave-b-admin-reader` | 076-goap-admin-recovery-and-book-crud | cloudflare-worker-api + reader-ui-ux |
| B | G19 Progress load | #536 | `wave-b-admin-reader` | 077-goap-reader-progress-and-search-load | reader-ui-ux |
| C | G20 Zod centralize | #537 | `wave-c-centralization` | 078-adr-zod-schema-centralization | cloudflare-worker-api + testing-strategy |
| C | G21 Grants UI | #538 | `wave-c-centralization` | 079-goap-admin-grants-patch-ui | reader-ui-ux |
| C | G23 Compensating test | #540 | `wave-c-centralization` | 080-adr-session-storage-compensating-controls | testing-strategy |
| C | G24 Catalog test | #541 | `wave-c-centralization` | (issue only) | testing-strategy |
| D | G25 ADR-068/092 files | (docs PR) | `wave-d-ux-docs` | 068-adr, 092-adr | docs |
| D | G26 ADR-INDEX | (docs PR) | `wave-d-ux-docs` | 083-adr-adr-numbering | docs |
| D | G27 CHANGELOG + CONTRIBUTING | (docs PR) | `wave-d-ux-docs` | 084-goap-changelog-and-contributing-sync | docs |
| D | G28 Panel mutual exclusivity | #546 | `wave-d-ux-docs` | 082-adr-reader-side-panel-mutual-exclusivity | reader-ui-ux |

## 3. Strategy

**Sequential waves with parallel slices inside each wave.**

### Wave A — Tenant Isolation (Critical) — 1 PR, 3 commits

- **Why first:** G14, G16, G22 share a `book_access_grants` helper
  and the same fixtures. Any code that writes a comment, progress,
  highlight, or bookmark without tenant-isolation is wrong by
  definition, so the rest of the system cannot be trusted until
  this lands.
- **Sequence within PR:** tests first, then fix per gap, then
  combined regression test. Each commit is independently
  runnable.
- **Rollback:** single `git revert` of the merge commit; the
  reader flow continues to work without tenant-isolation (it was
  already working that way), so the only cost of revert is
  re-introducing the IDOR — accept only for emergency.

### Wave B — Admin enablement + email + reader progress — 1 PR, 4 commits

- **Why second:** G15 (email transport) is the dependency for G17
  (admin recovery). G18 (book CRUD) and G19 (progress load) are
  independent of G15 but share the Wave B branch because they
  touch the same surface area.
- **Sequence within PR:** G15 first (introduces
  `EmailTransport` interface + dev default), then G17 (consumes
  it for admin recovery), then G18 (admin book PATCH/DELETE), then
  G19 (reader progress load).
- **Rollback:** same as Wave A; the dev-default email transport
  means rollback is safe in any environment.

### Wave C — Centralization + governance — 1 PR, 4 commits

- **Why third:** G20 (Zod centralization) makes the schemas
  available to G14/G22 regression tests in Wave A's follow-up
  refactor and to G24's catalog test. G21, G23, G24 are
  independent of each other.
- **Sequence within PR:** G20 first (refactor), G24 (use new
  schemas), G21 (UI), G23 (regression test).
- **Rollback:** Zod centralization is backward-compatible
  (re-exports the same names from the new location), so rollback
  is mechanical.

### Wave D — UX + docs — 1 PR, 4 commits

- **Why last:** G25, G26, G27 are docs only; G28 is a small UX
  change that is best reviewed when everything else is stable.
- **Sequence within PR:** G28 (code), then G25 + G26 + G27
  (docs), then CHANGELOG re-sync to record the wave.
- **Rollback:** trivial.

## 4. Agent Assignment

| Wave | Primary agent | Secondary agent |
|------|---------------|-----------------|
| A | cloudflare-worker-api | testing-strategy, testdata-builders |
| B | cloudflare-worker-api | reader-ui-ux, i18n-key-author |
| C | cloudflare-worker-api | reader-ui-ux, testing-strategy |
| D | reader-ui-ux | docs-writer |

`triz-analysis` is invoked before Wave A and Wave B (architectural
changes). `release-management` is invoked once at the end of Wave D
for the final CHANGELOG cut.

## 5. Quality Gates

Every PR must pass, in order:

1. `./scripts/minimal_quality_gate.sh` (lint + typecheck).
2. `./scripts/quality_gate.sh` (lint + typecheck + tests +
   coverage).
3. `./scripts/validate-workflows.sh` (actionlint + zizmor).
4. `gh pr checks` — all required status checks green.
5. Codacy — no new issues introduced.
6. Coverage thresholds per AGENTS.md TIER-2:
   web 55% / 48%, worker 55% / 50%, shared 40% / 50%,
   reader-core 72% / 70%, schema 15% / 5%, testkit 25% / 20%,
   ui 10% / 5%.
7. Reviewer approval from CODEOWNERS.

If any gate fails, the PR is blocked. The next wave does not start
until the previous wave is merged and `main` is green.

## 6. Atomic Commit Plan (per wave)

### Wave A (one PR, three atomic commits)

1. `test(worker): add tenant-isolation regression suite (failing)`
2. `fix(worker): enforce book_access_grants in comments, progress, highlights, bookmarks (G14, G16, G22)`
3. `refactor(worker): re-validate locator JSON on read (G16)`

### Wave B (one PR, four atomic commits)

4. `feat(worker): introduce EmailTransport interface + LoggingEmailTransport dev default (G15)`
5. `feat(worker): add admin password recovery endpoints (G17)`
6. `feat(worker,web): add admin book PATCH/DELETE + UI (G18)`
7. `feat(web): load saved progress on reader open (G19)`

### Wave C (one PR, four atomic commits)

8. `refactor(worker): centralize inline Zod schemas in @do-epub-studio/schema (G20)`
9. `test(worker): cover /api/catalog visibility filter (G24)`
10. `feat(web): wire orphan GrantForm + GrantList in GrantsPage (G21)`
11. `test(web,worker): assert security-posture compensating controls (G23)`

### Wave D (one PR, four atomic commits)

12. `feat(web): enforce reader side-panel mutual exclusivity (G28)`
13. `docs(plans): add ADR-068, ADR-092, ADR-INDEX (G25, G26)`
14. `docs: refresh CHANGELOG + CONTRIBUTING (G27)`
15. `docs(plans): record execution of plan 095 (this plan)`

## 7. Tracking Issues

Four tracking issues are opened (one per wave) and pinned to the
project. Each tracking issue contains a checklist of the gaps it
closes, the wave's quality gate, and the wave's atomic commit
list. The tracking issues are closed when the wave PR merges.

| Wave | Tracking issue title |
|------|----------------------|
| A | `[Wave A] Tenant isolation — G14, G16, G22 (Critical)` |
| B | `[Wave B] Admin enablement + email + reader progress — G15, G17, G18, G19` |
| C | `[Wave C] Centralization + governance — G20, G21, G23, G24` |
| D | `[Wave D] UX + docs — G25, G26, G27, G28` |

## 8. Risk & Rollback

- **Wave A risk:** tenant-isolation change can break the existing
  reader flow. Mitigation: per-tenant regression test asserts the
  happy path still works.
- **Wave B risk:** email transport can spam in dev. Mitigation:
  dev default is `LoggingEmailTransport`; production-only
  `EmailEventTransport` is feature-flagged via
  `WORKER_ENV=production`.
- **Wave C risk:** Zod centralization can break route shapes.
  Mitigation: re-exports preserve the same exported names.
- **Wave D risk:** docs-only changes have no runtime risk;
  G28 is a small UI change with a test.

If a wave must be rolled back, the rollback commit is the merge
revert. The next wave is paused until the rollback is verified.

## 9. Reference

- `plans/075-goap-swarm-2026-06-15.md` (master plan)
- `plans/096-adr-merge-order-policy-2026-06-15.md` (companion ADR)
- `analysis/SWARM_ANALYSIS.md` (2026-06-15)
- `plans/ADR-INDEX.md`
- AGENTS.md TIER-1 / TIER-2 rules
