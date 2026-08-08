# Taste (Continuously Learned by [CommandCode][cmd])

[cmd]: https://commandcode.ai/

# Workflow
- Follow AGENTS.md as the single source of truth for coding workflow on this project. Confidence: 0.85
- Use GOAP skill as orchestrator with a swarm of agents for multi-step tasks. Confidence: 0.85

# Git
- Use atomic git commits via `./scripts/atomic-commit/run.sh --message "type(scope): description" --body "WHY"`. Confidence: 0.85

# CI
- All GitHub Actions must pass before considering work complete. Confidence: 0.85
- When updating GitHub Action SHAs in workflow files, also update `scripts/validate-shas.sh` allowlist. Confidence: 0.80
- Run `./scripts/validate-workflows.sh` locally after editing workflow files to verify before committing. Confidence: 0.70
- When batch-editing `uses:` lines in workflow YAML, account for varying indentation (4/6/8 spaces) across job contexts — use exact-match per occurrence or read-then-edit individually. Confidence: 0.70
