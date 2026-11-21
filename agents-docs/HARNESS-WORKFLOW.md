# Harness Workflow — Canonical Agent Execution Path

> Issue #1492. This is the canonical goal-to-merge workflow for contributors and
> coding agents. It replaces ad-hoc "load every skill, run everything" loops
> with a single deterministic path: inspect → select → slice → sensors →
> integration → release gate → evidence → learning. The CLI is the primary
> interface; MCP integrations are optional and only when they materially
> improve the workflow, always with a CLI fallback.

## 1. The loop at a glance

```
inspect issue/plan ──► select skills (intent + changed paths)
        │                        │
        ▼                        ▼
  implement smallest slice ◄── plan: skills + sensors + commands + skips
        │                        │
        ▼                        ▼
  run affected sensors ──► escalate: fast → integration → release gate
        │                        │
        ▼                        ▼
  evidence JSON ──► PR summary ──► capture learning (learn skill)
```

- **Selection is never "load all skills".** Skills are picked from task intent
  (the issue/plan text) plus the changed paths, via the profiles in
  `scripts/harness/profiles.json`.
- **Commands are never duplicated.** Profiles reference sensor ids that resolve
  to `do-harness.toml` argv, and gate check ids that resolve through
  `scripts/harness/gate-commands.mjs` from `scripts/gate-manifest.json`. The
  `profiles-consistency` gate check fails if either source drifts.
- **Fast feedback is not release verification.** Every non-release plan prints
  the disclaimer and emits `verificationLevel: fast|integration|release`; only
  the full release gate (`./scripts/quality_gate.sh` + CI Full Quality Gate)
  is merge-blocking.

## 2. The CLI (primary interface)

```bash
# Plan for the current branch's changed paths
node scripts/harness/select.mjs --explain
node scripts/harness/select.mjs --json

# Plan for explicit paths
node scripts/harness/select.mjs --changed packages/schema/src/dtos.ts --explain

# From a git range
node scripts/harness/select.mjs --diff origin/main HEAD --json

# Run the planned commands and record results
node scripts/harness/select.mjs --run --json

# Escalate to the full release gate (closes the gap vs gate-manifest)
node scripts/harness/select.mjs --release --json

# Drift guard (also runs as the profiles-consistency gate check)
node scripts/harness/check-profiles-consistency.mjs
```

Root aliases: `pnpm harness:select -- …` and `pnpm harness:consistency`.

MCP: optional. If an MCP server exposes harness commands, it MUST delegate to
this CLI (or `do-harness verify/explain`) and must not re-implement selection —
a divergent copy is the exact drift this workflow exists to prevent.

### Output

- Text (`--explain`): selected profiles, skills, sensors (with resolved
  commands), gate checks, dependency edges, skipped sensors + reasons, command
  list, verification level, disclaimer.
- JSON (`--json`): evidence document (see §5). `--run` fills `results` with
  per-command exit codes and durations.

### Verification levels

| Level         | When                                                                        | Meaning                     |
| ------------- | --------------------------------------------------------------------------- | --------------------------- |
| `fast`        | default; no browser/build/integration sensor selected                       | subset feedback only        |
| `integration` | a browser/build sensor or the E2E profile is selected                       | affected integration checks |
| `release`     | every `gate-manifest.json` `local.checks` is covered (or `--release` given) | full gate parity            |

Every non-release output carries the disclaimer:
_FAST/SUBSET FEEDBACK — NOT full release verification … Run

claiming release verification._

## 3. Sensor profiles (data file)

`scripts/harness/profiles.json` defines the six required profiles plus the E2E
integration profile:

| Profile            | Paths (globs)                                                                                                                | Sensors (derive commands)                                                                              | Skills                                          |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| `reader-core`      | `packages/reader-core/**`, shared epub/archive validators                                                                    | typecheck, lint, test-unit                                                                             | epub-rendering-and-cfi, safe-regex-authoring    |
| `worker-api`       | `apps/worker/**`, `wrangler.toml`, worker workflows                                                                          | typecheck, lint, test-unit, app-identity                                                               | cloudflare-worker-api, secure-invite-and-access |
| `pwa-offline`      | `apps/web/src/**`, `packages/ui/**`, budgets                                                                                 | typecheck, lint, test-unit, bundle, web-ui-tests                                                       | pwa-offline-sync, frontend-design, anti-ai-slop |
| `authoring-export` | seed/demo scripts, packager, author feature, export hooks                                                                    | typecheck, lint, test-unit                                                                             | dogfood, testdata-builders                      |
| `accessibility`    | web/ui TSX + CSS + i18n                                                                                                      | a11y, viewport-ux, console, i18n, web-ui-tests                                                         | accessibility-auditor, reader-ui-ux             |
| `docs-skills`      | `agents-docs/**`, `docs/**`, AGENTS/README/CHANGELOG/VERSION, llms*, plans, `.agents/**`, `.claude/**`, `scripts/harness/**` | skills, agent-sync, adr-index, plan-references, llms-drift, compliance-drift, release-notes, workflows | agents-md, skill-creator                        |
| `integration-e2e`  | `apps/tests/**`, e2e workflows                                                                                               | typecheck, test-unit                                                                                   | dogfood, testing-strategy                       |

**Rules enforced by the consistency check (`profiles-consistency`):**

- every `sensors` id exists in `do-harness.toml` (argv is the single command
  source for sensors);
- every `gateChecks` id exists in `gate-manifest.json` `local.checks` and has a
  resolver entry in `gate-commands.mjs`;
- every `local.checks` id has a resolver entry (no orphan gate claims);
- every `skills` id exists under `.agents/skills/`;
- dependency targets reference existing profile ids.

Adding a profile or referencing a new check/sensor/skill without updating the
canonical sources fails the gate check — that is the drift detector.

### Dependency-aware selection

Explicit edges in `profiles.json.dependencies` expand selection to consumers:

- `packages/schema/**` → `worker-api`, `pwa-offline`, `integration-e2e`
- `packages/reader-core/**` → `pwa-offline`, `worker-api`, `integration-e2e`
- `packages/shared/**` → every workspace consumer

A schema-only change therefore selects worker + web/PWA + E2E profiles and
their sensors without any manual guesswork. Selection output is deterministic:
profiles are ordered by declaration, sensors/commands by profile order,
duplicates removed, and changed paths are sorted before matching.

## 4. Task lifecycle (the steps)

1. **Inspect** — read the issue/plan; extract the changed-path set
   (`git diff --name-only origin/main...`).
2. **Select** — `node scripts/harness/select.mjs --changed … --explain`.
   Read the plan: profiles, skills, sensors, skips. Load only the listed
   skills (L2) — never all 40+.
3. **Slice** — implement the smallest change slice; re-run select as paths
   change.
4. **Run affected sensors** — `node scripts/harness/select.mjs --run --json`
   (or run the printed commands directly). Fix failures before continuing.
5. **Escalate** — when the slice is complete, ensure integration checks that
   need a browser/dev-server (a11y, viewport, perfor, visual, console, i18n,
   E2E) are exercised: add the required paths or use `--release` to close the
   gate gap, then run the full `./scripts/quality_gate.sh`.
6. **Release gate** — CI Full Quality Gate remains authoritative and
   merge-blocking (ADR-246). Local fast/integration evidence never substitutes
   for it.
7. **Evidence** — attach the `--json` evidence document to the PR summary:
   changed paths, selected sensors/skills/commands, skipped + reasons,
   per-command results, environment facts, verification level.
8. **Learn** — run the `learn` skill; file non-obvious discoveries in
   `agents-docs/LEARNINGS.md` / `scripts/AGENTS.md` / skill `AGENTS.md` per
   the POST-TASK LEARNING rules (silence is not a valid skip).

## 5. Evidence JSON schema

```jsonc
{
  "kind": "do-harness-select",
  "version": 1,
  "changedPaths": ["packages/schema/src/dtos.ts"],
  "selection": {
    "profiles": [
      {
        "id": "worker-api",
        "label": "Worker / API",
        "triggeredBy": ["packages/schema/src/dtos.ts"],
        "reasons": ["dependency: schema"],
      },
    ],
    "skills": [{ "id": "cloudflare-worker-api", "profile": "worker-api", "why": "…" }],
    "sensors": [
      {
        "id": "typecheck",
        "profile": "worker-api",
        "command": ["pnpm", "typecheck"],
        "triggeredBy": ["…"],
      },
    ],
    "gateChecks": [{ "id": "build", "profile": "worker-api", "command": ["pnpm", "build"] }],
    "dependencies": [{ "id": "schema", "matchedBy": ["…"], "targets": ["worker-api", "…"] }],
    "releaseGapChecks": [],
  },
  "skipped": [{ "id": "a11y", "reason": "no matching changed path in a selected profile" }],
  "commands": [
    ["pnpm", "lint"],
    ["pnpm", "typecheck"],
  ],
  "results": [{ "command": ["pnpm", "lint"], "exitCode": 0, "ok": true, "durationMs": 1234 }],
  "artifacts": [],
  "verificationLevel": "integration",
  "disclaimer": "FAST/SUBSET FEEDBACK — NOT full release verification. …",
  "env": {
    "node": "v22.x",
    "platform": "linux",
    "repoRoot": "…",
    "timestamp": "2026-11-19T00:00:00.000Z",
  },
}
```

`results` is empty unless `--run` executed the commands; `artifacts`
reserves space for runner-produced files. This document feeds the PR summary
and later `learn` ingestion.

## 6. Consistency model (manifests)

| Source                                           | Owns                                                              |
| ------------------------------------------------ | ----------------------------------------------------------------- |
| `scripts/gate-manifest.json`                     | the canonical check list per entry point (`local`/`pr`/`release`) |
| `scripts/quality_gate.sh` / CI                   | the live execution of those checks                                |
| `do-harness.toml`                                | sensor definitions + argv for the sensor pack                     |
| `scripts/harness/gate-commands.mjs`              | check id → command binding (verified against the manifest)        |
| `scripts/harness/profiles.json`                  | path → profile → sensor/skill mapping (references only)           |
| `scripts/harness/check-profiles-consistency.mjs` | drift guard (gate check)                                          |

Changing `gate-manifest.json` or `do-harness.toml` requires re-running
`check-profiles-consistency.mjs`; the gate runs it automatically.
