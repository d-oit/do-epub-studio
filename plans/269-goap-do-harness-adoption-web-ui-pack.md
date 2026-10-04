# GOAP-269: do-harness adoption + web-ui sensor pack

**Status:** DONE (Phases 1–4 complete; web-ui pack scaffolded additively into `do-harness.toml`, 13 sensors, library suite 24/24)
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

| #   | Phase                                                                                                                                                                                      | Exit criteria                                                                                                           | Status                                                                                                                                                                                                                                                                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | CLI analysis (hands-on)                                                                                                                                                                    | findings recorded (this plan + ADR-246)                                                                                 | DONE                                                                                                                                                                                                                                                                                                                                                                      |
| 2   | Upstream fixes: POSIX installer + `sh -s` pipeline test in `test-install.sh` + template newline                                                                                            | PR merged to d-o-hub/do-harness; `sh < install.sh` installs v0.1.0 under dash                                           | DONE (merged upstream as 371b4ba via d-o-hub/do-harness#64)                                                                                                                                                                                                                                                                                                               |
| 3   | Adopt generic pack here: `do-harness init --language generic`, sensor toml wrapping the same scripts as `quality_gate.sh`, hooks beside atomic-commit, AGENTS.md loop note                 | `do-harness verify --set verification --changed --strict` green pre-push; `status` consulted before claiming completion | DONE (PR #1120; sensors wrap `pnpm verify:fast`/`typecheck`/`lint`/`test:unit`/`validate-skills.sh`; hooks intentionally not installed — `scripts/hooks/` stays authoritative; upstream-scaffolded python fixed for pyflakes + pre-commit EOF)                                                                                                                            |
| 4   | Upstream `web-ui` pack (ADR-246 §3–4): audit library (visibility → occlusion → overlap → overflow → focus/target-size), `init --language web`, evidence matrix manifest, ratchet + strikes | dogfood on this repo's Playwright lanes; ratchet baseline = zero new findings on main                                   | DONE (library merged upstream as 530d8d8 via d-o-hub/do-harness#75; 10 headless tests. Dogfooded on the live dev stack — first run 42 findings, triaged to 2 real WCAG 2.5.8 target-size defects fixed here plus 2 false-positive classes fixed in the library; second run: zero findings. Scaffold completed 2026-09-28 in `do-harness.toml` **additively** — see below) |

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
safe for the default set; it is registered with a `when-changed` list scoped to
`scripts/web-ui/**` so it only runs when the pack itself changes.

## Risks

- **Dual-gate drift**: mitigated by sensors wrapping the identical scripts
  the gate runs (ADR-246 §Decision 1).
- **False positives in text-overlap detection**: ratchet baselines +
  allowlists for intentional overlays (dialogs, toasts, badges); new
  findings block, legacy findings only decrease.
- **Visual flake**: strike counting (do-harness `metrics`) + masked dynamic
  regions + disabled animations/caret.
