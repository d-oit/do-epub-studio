# GOAP-269: do-harness adoption + web-ui sensor pack

**Status:** IN PROGRESS (upstream pack and local registration delivered; F2/F3/F5/F6/F7 fixed in GOAP-291/294 on 2026-09-30 — all six runners reach browser work, `web-ui-tests` is in the verification set and runs in CI; remaining: promote the CI context to a required check if desired — ADR-286 decision)
**Date:** 2026-09-13
**ADR:** ADR-246 (`plans/246-adr-do-harness-completion-contract.md`)

## Context

Hands-on analysis of `d-o-hub/do-harness` v0.1.0 (installed the released
binary, exercised `init`/`verify`/`status`/`explain` in a scratch workspace)
identified four workflow gaps it closes for this repo, two verified upstream
bugs, and one capability gap (no web/UI testing). Full findings were reported
in-session on 2026-09-13; the durable decisions are recorded in ADR-246.

Key verified findings:

- **Workflow value**: change-aware sensor selection (`when-changed` +
  `verify --changed`), evidence freshness (`green → edit → stale → verify →
green` via workspace/policy fingerprints), signal sets mapping to
  minimal/full gates, and trace → `distill` → `eval` skill growth.
- **Upstream bug 1 (reproduced)**: `scripts/install.sh` is bash
  (`set -euo pipefail`) but the documented invocation is `curl … | sh` —
  dash aborts with "Illegal option -o pipefail". `scripts/test-install.sh`
  only exercised bash file-mode, which is why it shipped.
- **Upstream bug 2 (reproduced)**: the generic TOML template lacks a
  trailing newline; appending sensor config glues onto the last comment line
  and produces a confusing parse error.
- **Capability gap**: no web/UI sensors at all, while this repo already
  home-grew the pattern (`apps/tests/viewport-matrix.ts`,
  `viewport-regression.spec.ts`) to generalize.

## Phases

| #   | Phase                                                                                                                                                                                      | Exit criteria                                                                                                           | Status                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | CLI analysis (hands-on)                                                                                                                                                                    | findings recorded (this plan + ADR-246)                                                                                 | DONE                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2   | Upstream fixes: POSIX installer + `sh -s` pipeline test in `test-install.sh` + template newline                                                                                            | PR merged to d-o-hub/do-harness; `sh < install.sh` installs v0.1.0 under dash                                           | DONE (merged upstream as 371b4ba via d-o-hub/do-harness#64)                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 3   | Adopt generic pack here: `do-harness init --language generic`, sensor toml wrapping the same scripts as `quality_gate.sh`, hooks beside atomic-commit, AGENTS.md loop note                 | `do-harness verify --set verification --changed --strict` green pre-push; `status` consulted before claiming completion | DONE (PR #1120; sensors wrap `pnpm verify:fast`/`typecheck`/`lint`/`test:unit`/`validate-skills.sh`; hooks intentionally not installed — `scripts/hooks/` stays authoritative; upstream-scaffolded python fixed for pyflakes + pre-commit EOF)                                                                                                                                                                                                                                 |
| 4   | Upstream `web-ui` pack (ADR-246 §3–4): audit library (visibility → occlusion → overlap → overflow → focus/target-size), `init --language web`, evidence matrix manifest, ratchet + strikes | dogfood on this repo's Playwright lanes; ratchet baseline = zero new findings on main                                   | DELIVERED UPSTREAM / SCAFFOLDED LOCALLY (not operationally complete — F2/F3/F7 in Current audit follow-up; library merged upstream as 530d8d8 via d-o-hub/do-harness#75; 10 headless tests. Dogfooded on the live dev stack — first run 42 findings, triaged to 2 real WCAG 2.5.8 target-size defects fixed here plus 2 false-positive classes fixed in the library; second run: zero findings. Scaffold completed 2026-09-28 in `do-harness.toml` **additively** — see below) |

## Verification

- Phase 2: `shellcheck scripts/install.sh scripts/test-install.sh` clean;
  repo `check-shell.sh` (30 scripts) clean; `cargo build --release -p
do-harness && scripts/test-install.sh` green (bash file mode + `sh -s`
  pipeline mode + tamper rejection); `sh < install.sh --version v0.1.0`
  installs the real release under dash.
- Phase 3: `do-harness doctor` + `verify --set verification --changed
--strict` + `status --set verification` = green after `--changed` edits.
- Phase 4: `scripts/web-ui/` (the shipped audit library, 24/24 headless tests)
  and the six runners committed; `do-harness.toml` carries 13 sensors — the six
  from Phase 3 plus `web-ui-tests` and the six web sensors; `do-harness list`
  shows all 13; `verify --set web-ui` returns six WARNs and exit 0 with no
  `WEB_AUDIT_ROUTES`; `verify --set verification` green. CI visual/viewport
  lanes unchanged.

### The scaffold was applied additively, not via `init --language web`

`do-harness init --language web` does not _add_ a pack — it **rewrites**
`do-harness.toml`, `AGENTS.md` and `plans/invariants.json`. Verified in a
throwaway repo: the command emitted `language = "web"` and replaced the
signal sets outright. Running it here would have discarded Phase 3's six
sensors, including `loc` — whose `when-changed` list and the ADR-278 baseline it
encodes — and overwritten `AGENTS.md`, which ADR-285 and
`check-agent-sync.mjs` now govern.

So the runners and library were copied from a throwaway scaffold and the sensor
blocks appended, leaving the generic pack intact. `do-harness list` reports 13
sensors, which is the check that the merge actually took.

### Why the six web sensors are not in the default `verification` set

Each of `viewport-ux`, `a11y`, `console`, `perf`, `visual` and `i18n` needs a
running dev server (`WEB_AUDIT_BASE_URL`) and a route list
(`WEB_AUDIT_ROUTES`). They live in their own `web-ui` signal set so the pack is
available without making the default set unrunnable — the runners print
`SKIP:` and exit 0 when unconfigured, which `verify` reports as WARN and
`--strict` promotes, so a developer without a browser is never blocked.

`web-ui-tests` (the library's own suite) _is_ browser-independent and therefore
safe for the default set: its command covers the pure Node tests plus an
optional browser suite that self-skips without Playwright
(`node --test scripts/web-ui/audit.test.mjs scripts/web-ui/audit.browser.test.mjs`).
It is registered with a `when-changed` list scoped to `scripts/web-ui/**` and
`scripts/*-audit.mjs` and — since GOAP-291 (2026-09-30) — is a member of the
`verification` signal set, matching `do-harness.toml`'s comment calling it "the
one piece of the web pack that belongs in the default `verification` set".
`do-harness explain --set verification` now selects it. The originally audited
state (registered but in no set, F3) is recorded in the follow-up below.

## Current audit follow-up

`analysis/feature-docs-harness-audit.md` (GOAP-290, 2026-09-30) re-probed the
committed pack read-only; GOAP-291 (`plans/291-goap-web-ui-pack-corrective.md`)
then implemented the items that needed no further decision. Dispositions:

- **F2 — configured runners cannot reach browser work. FIXED (GOAP-291).**
  Every `scripts/{viewport,a11y,console,perf,visual,i18n}-audit.mjs` now
  resolves Chromium through `scripts/web-ui/lib/playwright.mjs`
  (`@playwright/test` first, then `playwright`). Verified: configured runs
  against a served fixture all reach browser work (`viewport` audited 13
  cells), and the pure suite pins the resolver.
- **F2 fallout — hidden a11y defect, fixed in the same slice.**
  `scripts/a11y-audit.mjs` created its page with `browser.newPage()`, which
  axe-core/playwright 4.13 rejects ("Please use browser.newContext()"); the
  F2 fix unmasked it. Now uses an explicit context and reports `OK: a11y
clean on 1 route(s)`.
- **F3 — `web-ui-tests` was selected by no set. FIXED (GOAP-291 + GOAP-294).**
  It is in the `verification` set (`do-harness explain --set verification`
  selects it) and CI now runs the identical command in the `Web UI Audit
Suite` job with Chromium installed (28/28 locally, 15/15 workflows
  validated). Promoting that context to a required check stays an ADR-286
  maintainer decision — not claimed here.
- **F5 — i18n direction judged before navigation. FIXED (GOAP-291).**
  `auditLocales` checks `dir`/`lang` after `runProbe(locale)`. Regression
  test proven to fail on the pre-fix revision (false `ar` finding, missed
  wrong-dir `he`) and pass after.
- **F6 — absent measurements read as clean. FIXED (GOAP-291).**
  `missingMetrics()` + the runner's SKIP line: a stubbed-Lighthouse run with
  null metrics prints `SKIP: no usable performance measurements … budgets not
evaluated` instead of the OK line; real metrics still print OK and slow
  metrics still exit 1 with four breaches.
- **F7 — viewport matrices diverged. FIXED (GOAP-291).** Both
  `apps/tests/viewport-matrix.ts` and `scripts/web-ui/lib/audit.mjs` now cover
  the same 13 sizes (the four ADR-246 sizes were added to the former; 375×812
  to the latter), and the browser lane audit prints 13 cells.

Not a gap, intentionally unchanged: the six route-dependent sensors stay
opt-in in the `web-ui` set, and the 24/24 library-suite result above remains
historical evidence from this plan, not a fresh pass.

## Risks

- **Dual-gate drift**: mitigated by sensors wrapping the identical scripts
  the gate runs (ADR-246 §Decision 1).
- **False positives in text-overlap detection**: ratchet baselines +
  allowlists for intentional overlays (dialogs, toasts, badges); new
  findings block, legacy findings only decrease.
- **Visual flake**: strike counting (do-harness `metrics`) + masked dynamic
  regions + disabled animations/caret.
