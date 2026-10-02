# GOAP-290: Feature, docs and harness analysis — audit + progress reconciliation

**Status:** DONE (analysis and progress reconciliation only; corrective implementation not started)
**Date:** 2026-09-30
**Type:** Read-only audit + progress reconciliation (documentation only)
**ADRs referenced:** ADR-214 (audit recommendation governance — classify before implementing, evidence before claims), ADR-246 (do-harness completion contract), ADR-999 (assistance contract)
**Canonical report:** `analysis/feature-docs-harness-audit.md` (finding inventory F1–F10)

## Purpose

Publish a grounded three-domain audit — missing/incomplete product
implementation, documentation truth, harness enforcement — and reconcile the
progress records that overstated completion, without implementing corrective
work, changing security policy, upgrading dependencies, or installing tools.

## Completed analysis checklist

- [x] Three read-only domain audits: product contracts, documentation truth,
      harness enforcement (scouts + main synthesis).
- [x] Primary-source research with an actual lookup date (2026-09-30):
      do-harness, Playwright, Transformers.js, Cloudflare D1 local dev,
      Core Web Vitals guidance.
- [x] Read-only probes on this tree: `do-harness` CLI, six audit-runner
      skips, bare-vs-scoped Playwright resolution, `db:*` script targets,
      engine-less plugin, `evaluateBudgets`, `auditLocales` seam.
- [x] Progress reconciliation of GOAP-269/276/999/273/284 + `ADR-INDEX.md`
      (statuses now match the evidence; shipped work preserved).
- [x] Rejected two scout false positives (visual sensor already selects app
      CSS; the 0.5B/q8 story/logic tuning must not be reverted on older
      1.5B/q4 prose).

## Findings pointer (no backlog duplicated here)

Corrective work is specified per finding with its own acceptance test in the
report:

- **P1:** F1 (creator assistance integration incomplete — panel dispatches the
  engine-less plugin with empty input), F2 (six configured runners resolve the
  wrong Playwright package and SKIP), F3 (`web-ui-tests` registered but in no
  signal set; no CI harness evidence), F4 (README/quick-start DB commands
  target Turso/absent scripts instead of the D1 binding).
- **P2:** F5 (i18n direction judged before locale navigation), F6 (absent
  performance measurements print as budgets met), F7 (viewport matrices
  diverged from ADR-246), F8 (progress/qualification claims drift), F10
  (inferred CSP/model-origin deployment gap).
- **P3:** F9 (vacuous insights assertion).

Each corrective item requires its own executable spec; executing this plan
authorizes none of them.

## Verification

- `node scripts/check-adr-index.mjs` → exit 0 after the markdown integration,
  with only the two pre-existing warnings (archived ADR-063b; ADR-111 Proposed
  header under a finished index row).
- Throwaway read-only Node assertion over the edited files: 269/276/999
  headers + index rows begin `IN PROGRESS`; 273/284 retain `DONE`; the 290 row
  is explicitly analysis-only DONE; 271/272/288 index rows carry existing GOAP
  paths; AI-01/AI-03 rows are PARTIAL and AI-02 DONE; the seven Phase 0
  resolution rows remain; all ten finding IDs exist in the report.
- No app tests, builds, migrations, browser sessions or model downloads were
  run: the change surface is markdown only.

**Corrective follow-up (same day):** GOAP-291
(`plans/291-goap-web-ui-pack-corrective.md`) implemented F2, F5, F6, F7 and the
F3 signal-set membership; GOAP-292 (`plans/292-goap-local-setup-truth-d1.md`)
implemented F4 (working D1 migration commands, Turso-service tooling deleted,
docs/runbook aligned); GOAP-293 (`plans/293-goap-assistance-integration.md`)
implemented F1 (grounded creator review: real chapter text through read
access, per-category engine dispatch, honest no-engine/no-access states);
GOAP-294 (`plans/294-goap-web-ui-suite-ci-evidence.md`) closed F3's CI half
(Web UI Audit Suite job). GOAP-295 fixed the reader search/prefetch
`book.spine` no-op surfaced by GOAP-293. GOAP-296 replaced the vacuous
insights assertion with a real proof (F9) and recorded the CSP deployment
acceptance requirement (F10). GOAP-297 fixed the mock-E2E lane's
non-rendering (fixture ZIP/DEFLATE, CFIs, route interception) and hardened
the reader against unparseable stored CFIs. Remaining: the AI-03 human style
review.

## Deliberate non-actions

- `do-harness status --set verification` was left stale (`workspace_changed`
  exit 1) rather than refreshed to make the audit look green.
- No do-harness upgrade, `init`, or hook installation; repo hooks remain
  authoritative (ADR-246).
- No edit to `qualification.ts`, engine/model defaults, CSP, CI or
  required-check policy.
