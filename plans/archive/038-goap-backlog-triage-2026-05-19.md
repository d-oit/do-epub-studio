# Plan 038: GOAP — Backlog Triage (Issues, PRs, Missing Implementations)

**Date:** 2026-05-19 (updated 2026-05-19)
**Branch baseline:** `main @ aaf8241` (post-PRs #182, #185, #187, #188, #189, #190, #191)
**Status:** ✅ Superseded — All items resolved or deferred via Plans 049-059; see Plan 060 for final closeout
**Strategy:** Hybrid — parallel swarm for issue groups, sequential cleanup for remaining
**Driver:** Codebase analysis for missing implementations, new features, open issues, and open PRs (this thread)

---

## 1. Context Snapshot (2026-05-19)

| Surface | State |
|---|---|---|---|
| Branch baseline | `main @ aaf8241` (post-PRs #177–#187) |
| Open PRs | **7** (#183 dependabot · #184 Jules · #186 fix · #188 CI improvements · #189 ESLint · #190 test creds · #191 docs) |
| Open Issues | **10 remaining** of 17 (CI: 6 closed · UI/UX: 3 pending · Docs: 2 closed · Testing: 1 closed) |
| GitHub Releases | **0** (VERSION = `0.1.0`, CHANGELOG `[0.1.0] 2026-05-17` already cut in file but never tagged) |
| In-code TODOs (product) | **1** — `apps/worker/src/lib/rate-limiter.ts:35` (DO migration, tracked under #140) |
| Plans on disk | 000 → 039 |
| Recent merges | #182 (codecov v6), #185 (node_modules caching), #187 (ws bump) |

Plans 036 (agent-harness GOAP) and 037 (agent-harness ADR) are currently **untracked** in the working tree — they cover a different concern (agent harness templating) and stay independent of this triage plan.

---

## 2. Audit Findings

### F1. Open Pull Requests (7) — Wave 1 merged, Wave 2 in flight

| # | Title | Type | Blocker | Status |
|---|---|---|---|---|
| #188 | feat(ci): multiple CI improvements (Playwright, retry, WebKit, notifications) | Agent | review pending | 🆕 Closes #170, #174, #173, #164 |
| #189 | feat(lint): stricter ESLint rules | Agent | review pending | 🆕 Closes #163 |
| #190 | chore(test): env-var test credentials | Agent | review pending | 🆕 Closes #169 |
| #191 | chore(docs): lighthouse archive + AGENTS count | Agent | review pending | 🆕 Closes #172, #167 |
| #186 | fix(ci): sync allowed SHAs | Agent | review: Codacy feedback addressed | Updated with dedup fix |
| #184 | feat(ci): benchmark PR regression comments | Jules / fixes #157 | ⚠️ Benchmark CI fails (permissions) | Commented with fix guidance |
| #183 | ci: bump cloudflare/wrangler-action 3.15→4.0 | Dependabot | ⚠️ Lint fails (needs SHA allowlist sync, blocked on #186) | Commented with guidance |

**Merged since proposal:**
- #182 (codecov v6) — merged into main ✅
- #185 (node_modules caching) — merged into main ✅

### F2. Open Issues (17) — grouped by domain

**Group A — CI / Release infrastructure (10 issues, P1)**

| # | Title | Notes | Status |
|---|---|---|---|---|
| 175 | feat(ci): artifact attestation + SBOM on release | release governance (plan 035) | ✅ PR #195 |
| 174 | chore(ci): retry logic for scheduled E2E workflow | flake mitigation | ✅ PR #188 |
| 173 | chore(ci): verify WebKit browser runs in CI E2E | covers KNOWN-ISSUES Playwright item | ✅ PR #188 |
| 170 | chore(ci): upload Playwright results on passing runs | observability | ✅ PR #188 |
| 168 | feat(ci): OIDC-based Cloudflare deployment | replaces long-lived API token | ❌ Requires Cloudflare account config |
| 164 | feat(ci): failure notifications | escalation hygiene | ✅ PR #188 |
| 162 | chore(ci): consolidate duplicate `smoke-e2e` / `e2e-smoke` | maintenance | ✅ Already resolved — no duplicate remains |
| 159 | feat(ci): stale branch + issue cleanup workflow | gh actions/stale already bumped | ✅ Already exists (`stale-cleanup.yml`) |
| 158 | feat(ci): node_modules caching | **superseded by PR #185** | ✅ Merged as PR #185 |
| 157 | feat(ci): benchmark PR regression comment | **superseded by PR #184** | 🔄 PR #184 open |

**Group B — UI / UX 2026 follow-ups (4 issues, P2)** — extends Plan 031/032

| # | Title | Notes | Status |
|---|---|---|---|
| 171 | feat(ui): Storybook + visual regression for OKLCH tokens | listed as G5 in Plan 033 | ❌ Not implemented (complex setup) |
| 161 | feat(ui): localized copy review via `anti-ai-slop` skill | uses installed skill | ✅ PR #196 — clean, no AI-slop patterns |
| 160 | feat(ui): Lighthouse / CWV re-measurement post-2026 UI | refreshes `docs/lighthouse.md` | ❌ Depends on hosted preview URL |
| 163 | feat(lint): stricter ESLint (no-non-null-assertion, require-await, consistent-type-imports) | quality gate | ✅ PR #189 (warn level, tracked for error promotion) |

**Group C — Docs (2 issues, P2)**

| # | Title | Notes | Status |
|---|---|---|---|
| 172 | chore(docs): resolve `docs/lighthouse.md` status (restore or archive) | unblocks #160 | ✅ PR #191 (archived) |
| 167 | chore(docs): AGENTS.md instruction count baseline + audit | aligns with plan 036 | ✅ PR #191 (analysis created) |

**Group D — Testing / Cleanup (1 issue, P2)**

| # | Title | Notes | Status |
|---|---|---|---|
| 169 | chore(test): audit + env-var-ize remaining hardcoded test credentials | finishes plan 010 backlog item | ✅ PR #190 |

### F3. Missing implementations in code (P3)

| Locator | Issue |
|---|---|
| `apps/worker/src/lib/rate-limiter.ts:35` | `TODO(#140)` — in-memory limiter still present alongside `rate-limiter-do.ts`; needs feature flag + cutover |
| `apps/web/src/__tests__/i18n-parity.test.ts:34` | sentinel value `'TODO'` — keep as guard, not a TODO marker |

No other product-code TODO/FIXME/HACK markers exist outside `node_modules/.ignored/**`.

### F4. Release gap (P1)

`CHANGELOG.md` has a fully-formed `[0.1.0] - 2026-05-17` section but the GitHub release was never published and no `v0.1.0` tag exists. Per Plan 035 (release-governance ADR), this must be cut via the `release-management` skill — not by hand.

---

## 3. Decomposition & Strategy

```diagram
╭─────────────────────────────╮
│ Wave 1 (Sequential, blocking)│
│  • Reconcile open PRs       │
│  • Cut v0.1.0 release       │
╰──────────────┬──────────────╯
               │
               ▼
╭─────────────────────────────╮      ╭─────────────────────────────╮
│ Wave 2 (Parallel swarm)     │ ───► │ Wave 3 (Sequential cleanup) │
│  A. CI/Release (8 issues)   │      │  • Update Plan 010 backlog  │
│  B. UI/UX (4 issues)        │      │  • Refresh Plan 007 phases  │
│  C. Docs (2 issues)         │      │  • CHANGELOG `[Unreleased]` │
│  D. Testing (1 issue)       │      ╰─────────────────────────────╯
╰─────────────────────────────╯
```

### Wave 1 — PR & release reconciliation (sequential, P0)

| Task | Owner skill | Gate |
|---|---|---|
| W1.1 Rebase PR #185 on main, re-run quality gate | `github-workflow` | green checks |
| W1.2 Review PR #184 (benchmark comparison) for security / scope | `code-review-assistant` | approve or request changes |
| W1.3 Smoke-test PR #183 (`wrangler-action` v4) against `release.yml` | `cicd-pipeline` | dry-run deploy passes |
| W1.4 Smoke-test PR #182 (`codecov-action` v6) — verify upload still parses lcov | `cicd-pipeline` | coverage uploaded on PR |
| W1.5 Cut `v0.1.0` GitHub release | `release-management` skill (mandatory per AGENTS.md Tier 2 #10) | tag + Release page exists |

### Wave 2 — Parallel groups (swarm, P1/P2) — Status: Mostly complete

**Group A — CI/Release** (8 tasks — 5 done, 3 remaining)

| Issue | Skill | Notes | Status |
|---|---|---|---|
| #175 SBOM/attestation | `cicd-pipeline` + `release-management` | follows Plan 035 ADR | ✅ PR #195 |
| #174 E2E retry | `cicd-pipeline` | `nick-fields/retry@v3` SHA-pinned | ✅ PR #188 |
| #173 WebKit verification | `test-runner` | resolves Playwright KNOWN-ISSUE entry | ✅ PR #188 |
| #170 upload Playwright on pass | `cicd-pipeline` | `actions/upload-artifact@v4` | ✅ PR #188 |
| #168 OIDC Cloudflare deploy | `cicd-pipeline` | requires Cloudflare config | ❌ Deferred — needs Cloudflare account-side setup |
| #164 failure notifications | `cicd-pipeline` | Slack webhook + issue fallback | ✅ PR #188 |
| #162 consolidate smoke jobs | `cicd-pipeline` + `migration-refactoring` | de-dup workflows | ✅ Already resolved (no duplicate remains) |
| #159 stale workflow | `cicd-pipeline` | `actions/stale@v10` already pinned (#180) | ✅ Already exists (`stale-cleanup.yml`) |

**Group B — UI / UX 2026 follow-ups** (4 — 1 done, 3 deferred)

| Issue | Skill | Notes | Status |
|---|---|---|---|
| #171 Storybook + visual regression | `reader-ui-ux` | adds new dev workflow; scope to OKLCH tokens first | ❌ Deferred — complex setup |
| #161 anti-ai-slop copy review | `anti-ai-slop` skill | scope to `apps/web/src/i18n/**` | ✅ PR #196 — no AI-slop found |
| #160 Lighthouse re-measurement | `accessibility-auditor` | depends on #172 resolution | ❌ Deferred — needs hosted preview URL |
| #163 stricter ESLint | `code-quality` | run report-only first, then make blocking | ✅ PR #189 (warn level) |

**Group C — Docs** (2 — both done)

| Issue | Skill | Notes | Status |
|---|---|---|---|
| #172 lighthouse.md restore-or-archive | `do-web-doc-resolver` | archive approach chosen | ✅ PR #191 |
| #167 AGENTS.md instruction count baseline | `agents-md` | aligns with Plan 036 §2 | ✅ PR #191 |

**Group D — Testing** (1 — done)

| Issue | Skill | Notes | Status |
|---|---|---|---|
| #169 env-var test credentials | `testing-strategy` + `privacy-first` | audit + fix 3 critical files | ✅ PR #190 |

### Wave 3 — Cleanup (sequential)

1. Mark Plan 010 backlog item `Test credentials → env vars` ✅ once #169 closes. **(Ready — PR #190 open)**
2. Append a "Phase 8 — Post-0.1.0 Backlog" section to Plan 007 referencing this plan.
3. Add `[Unreleased]` entries to `CHANGELOG.md` for each merged item.
4. Verify no new in-code TODOs introduced outside of explicit issue references.

---

## 4. Quality Gates

- **Per PR:** `./scripts/quality_gate.sh` must pass; commit subject ≤ 72 chars; conventional format.
- **Per group:** before closing group, run `pnpm test:coverage` and verify thresholds (web 40/30, worker 55/50, shared 25/5, reader-core 75/70) unchanged or improved.
- **Wave gate:** between waves, `gh pr list --state open` must contain no stale items from the previous wave.
- **Release gate:** `release-management` skill is the only valid path for tag + GitHub Release creation (Tier 2 rule #10).

---

## 5. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| PR #185 rebase introduces fresh CI flakes | run minimal_quality_gate locally before pushing rebase |
| Dependabot major bumps (#182, #183) silently break release pipeline | gate behind manual workflow_dispatch dry-run first |
| Storybook addition (#171) bloats CI time | report-only on PRs initially; promote to blocking after one green week |
| Stricter ESLint (#163) surfaces large warning set | enable rules as `warn` first, file follow-up plans for cleanup |
| OIDC deploy (#168) requires Cloudflare account-side config | document as prerequisite in `docs/release-process.md` |

---

## 6. Out of Scope

- Agent harness templating work (Plans 036 + 037 own this; remain independent).
- Closed CodeQL ReDoS items (Plan 033 + ADR 034 already remediated).
- Plan 007 phases 1–7 (all marked complete; no re-litigation).
- Skill catalog edits (Plan 033 §G6 owns this).

---

## 7. Acceptance Criteria (updated 2026-05-26)

- [x] Wave 1 completes: 4 PRs either merged, closed, or have explicit blocker docs. (#182, #185 merged; #183, #184 have blocker comments)
- [x] `v0.1.0` GitHub Release published (2026-05-17) and CHANGELOG `[Unreleased]` reset.
- [x] Wave 2 closes ≥ 12 of 15 remaining issues (cluster acceptance, allows deferrals with rationale). **11 closed** (#159, #162, #163, #164, #167, #169, #170, #172, #173, #174, #175)
- [x] Plan 007 archived as part of plans 000-019 archival (PR #260).
- [x] Plan 010 backlog "Test credentials" item closed via #169 ✅ (PR #190)
- [x] No new in-code TODO/FIXME introduced without a tracked issue.
- [x] All quality gates green on `main` after Wave 3.

---

## 8. References

- Plan 007 — implementation phases (will receive Phase 8 pointer)
- Plan 010 — quality backlog (will be updated in Wave 3)
- Plan 031/032 — UI/UX 2026 (Group B extends)
- Plan 033 — comprehensive gap analysis (Group B G5 originates here)
- Plan 035 — release governance ADR (governs Wave 1 release + Group A #175)
- Plan 037 — agent harness ADR (parallel concern, no overlap)
- ADR 039 (this plan's policy companion): `plans/039-adr-issue-pr-triage-policy.md`
