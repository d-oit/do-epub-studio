# Plan: Swarm Analysis 2026-04-08

## Objective

Deliver a repository-wide gap assessment covering feature set, implementation completeness, documentation, testing, architecture, and security. Output actionable findings in `analysis/SWARM_ANALYSIS.md` with priorities, dependencies, and quick wins.

## Scope & Constraints

- Use analysis-swarm approach with role-differentiated agents
- Respect localization/offline/security requirements from ADRs
- Keep each source file touch <500 LOC
- No code edits beyond analysis artifacts unless gaps demand hotfix proposals

## Tasks

| #   | Task                                                      | Owner        | Dependencies    | Notes                                                            |
| --- | --------------------------------------------------------- | ------------ | --------------- | ---------------------------------------------------------------- |
| 1   | Confirm TRIZ analysis + solver outputs for audit workflow | OpenCode     | AGENTS workflow | Done (analysis/triz-core-2026-04-08 + plans/002 updates)         |
| 2   | Define swarm roles + prompts                              | OpenCode     | 1               | Roles: Feature+Implementation, Docs+Tests, Architecture+Security |
| 3   | Launch multi-agent scan in parallel                       | Swarm agents | 2               | Use `task` tool (explore agents) with repo read/glob access      |
| 4   | Aggregate findings, dedupe, map priorities                | OpenCode     | 3               | Tag quick wins + dependencies                                    |
| 5   | Publish report to `analysis/SWARM_ANALYSIS.md`            | OpenCode     | 4               | Include summary + perspective subsections                        |
| 6   | Capture learnings (`learn` skill)                         | OpenCode     | 5               | Focus on swarm orchestration insights                            |

## Success Criteria

- All six perspectives analyzed with file/path evidence
- Report lists per-gap impact, priority, suggested fix
- Cross-perspective confirmations and dependencies documented
- Quick wins identified (<0.5 day fixes)
- Learning recorded for future swarms
