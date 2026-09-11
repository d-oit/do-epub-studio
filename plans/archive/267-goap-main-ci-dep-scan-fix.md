# GOAP-267 — Main CI dep-scan HIGHs + hardening follow-up

**Date:** 2026-09-09 | **Orchestrator:** goap-agent skill (swarm W1–W5 + web research)
**Branch:** `fix/ci-main-dep-scan-hardening` | **Scope:** Full hardening, standalone `sharp@0.35.4`
**Trigger:** `pnpm audit --audit-level=high` fails on `origin/main` (6 HIGHs);
`plans/264` + `plans/266` follow-ups never landed as code.

## 1. ANALYZE

`dep-scan` (`ci.yml:147-161`) runs on `main` pushes only, so PRs stay green
while `main` reds. Lock evidence pre-fix: `fast-uri@3.1.5`, `sharp@0.35.3`
(via both `miniflare@5.20260815.0/5.20260820.0-alpha`), transitive
`js-yaml@4.3.1` via `cosmiconfig@9.0.2`. Direct `js-yaml@5.4.1` already clear.
Bundle absolute budget CLEAR post-#1094 (admin 76.7 KB vs 100 KB).

## 2. DECOMPOSE / DECISIONS (ADR)

- **D1 — floors, not pins:** `fast-uri ^3.1.5→^3.1.6`, `sharp ^0.35.0→^0.35.4`
  (resolves to 3.1.7 / 0.35.4; both include the fixes). `pnpm update <pkg>`
  alone is a no-op for transitive-only packages — the override bump +
  `pnpm install --lockfile-only` is the mechanism.
- **D2 — scoped override for the v4 edge:** `cosmiconfig>js-yaml: 4.3.2`
  (backport of the #797 fix). #1082's `5.4.1` bump never covered this edge.
- **D3 — standalone sharp, not wrangler 4.129:** lowest blast radius
  (user decision); miniflare stays on `5.202608xx-alpha`.
- **D4 — `build` needs-guard:** `fast-check` is PR-only, so default
  needs-semantics skipped `build` (and downstream `e2e-smoke`) on every
  `main` push. Added fail-closed guard:
  `if: always() && !contains(needs.*.result,'failure') &&
  !contains(needs.*.result,'cancelled')` — skipped deps allowed,
  failures still block.
- **D5 — codecov non-blocking:** `fail_ci_if_error: false` (coverage upload
  is informational; must not red `main` on outage).
- **D6 — doc drift:** budget strings said 80/90 KB vs actual 100 KB
  `lazyChunkJs` (`.performance-budgets.json:5`); fixed in
  `docs/performance-budgets.md`, `scripts/README.md`, `bundle-size.yml:75`.
  Enforcement always read the JSON — cosmetic only.

## 3. WEB SOURCES (official, no workarounds exist)

- fast-uri 3.1.6/2.4.5/4.1.3: GHSA-jqff-g426-hqxp, GHSA-5jgf-p345-68v8,
  GHSA-f65p-4m7j-42xc, GHSA-fph4-wmhf-6fwf (upgrade-only).
- sharp 0.35.4 (libheif 1.23.2): GHSA-rgj7-g3m4-5g8c
  (<https://github.com/lovell/sharp/releases/tag/v0.35.4>).
- js-yaml 4.3.2/3.15.2: GHSA-2883-xcg3-v3hh / CVE-2026-84375
  (<https://github.com/nodeca/js-yaml/pull/797>).

## 4. VERIFY

- `pnpm audit --audit-level=high --ignore-registry-errors` → green.
- `actionlint` on changed workflows → clean. `zizmor` unverifiable locally
  (container glibc predates the binary; pre-existing env limit, CI covers it).
- `./scripts/validate-workflows.sh` blocked locally by the same zizmor gap;
  actionlint pass + minimal diff (one `if:`, one flag) bound the risk.
- Full `quality_gate.sh` before commit per Tier 2.

## 5. FOLLOW-UPS (not in this change)

- `zizmor`/old-glibc container gap → environment backlog (CI green is source
  of truth for workflow security scanning).
- `dorny/paths-filter` master-HEAD SHA pin: SHA-pinned, acceptable as-is.
- CodeQL/Codacy/`ci-failure` label state: verify via `gh` where available
  (no `gh` in this container).
