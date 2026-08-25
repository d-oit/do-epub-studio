# Available Skills

Auto-generated from skill definitions. Run this script to regenerate.

| Skill | Description |
|-------|-------------|

## Coordination

| `goap-agent` | Invoke for complex multi-step tasks requiring intelligent planning and multi-agent coordination. Use when tasks need decomposition, dependency mapping, parallel/sequential/swarm execution strategies, or coordination of multiple specialized agents with quality gates. |
| `jules-delegator` | Use this skill to delegate complex coding tasks by creating Jules sessions via the Jules CLI. Jules is an AI coding agent that can autonomously implement features, fix bugs, and make code changes across repositories. |
| `skill-creator` | Create and edit skills. Activate for skill authoring, frontmatter optimization, or restructuring existing skills per the agentskills.io spec. |
| `task-decomposition` | Break down complex tasks into atomic, executable goals. Activate for multi-step feature planning, agent coordination, or request decomposition. |
| `triz-analysis` | Identify contradictions in system design. Activate for architecture decisions, permissions, offline sync, or EPUB rendering trade-offs. Must run BEFORE triz-solver. |
| `triz-solver` | Resolve contradictions found by triz-analysis. Activate after triz-analysis completes. Applies TRIZ principles to derive system design. |

## Knowledge-Management

| `learn` | Extract non-obvious session learnings into scoped files. MANDATORY after every non-trivial change (AGENTS.md Tier 2 #12): capture fragile config, quirks, or breakthroughs in the same PR that produced them. |
| `memory-context` | Retrieve past learnings and analysis via csm CLI. Activate at session start or when facing a problem that might have been solved before. |

## Quality

| `accessibility-auditor` | Audit web applications for WCAG 2.2 compliance, screen reader compatibility, keyboard navigation, and color contrast. Activate for "accessibility audit", "a11y check", "WCAG compliance", "screen reader test", or "keyboard navigation". |
| `agents-md` | Create AGENTS.md files with production-ready best practices. Activate when creating new AGENTS.md or implementing quality gates. |
| `anti-ai-slop` | Apply this skill whenever the user wants to audit, fix, redesign, write, or review UI, UX, copy, or text to avoid the generic "AI slop" aesthetic of 2025–2026. |
| `codacy` | Orchestrate static analysis using Codacy. Required PR check on this repo. Use for querying PR analysis, triaging issues, fixing (not suppressing) findings, and local analysis. See SKILL.md for fix patterns and the required-check policy. |
| `code-quality` | Review and improve inline code quality. Activate for code smells, refactoring, DRY violations, and best-practice fixes in active files. |
| `code-review-assistant` | Review pull requests holistically. Activate for PR analysis, risk assessment, cross-file consistency, and change-impact review. |
| `dogfood` | Systematically explore and test a web application to find bugs, UX issues, and other problems. Use when asked to "dogfood", "QA", "exploratory test", "find issues", "bug hunt", "test this app/site/platform", or review the quality of a web application. Produces a structured report with full reproduction evidence. |
| `impeccable` | Design guidance for AI coding agents. 23 commands, 44 deterministic detector rules, and live browser iteration for AI-generated frontend design. Activate for UI/UX design work, anti-pattern detection, or design quality audits. |
| `privacy-first` | Prevent email addresses and personal data from entering the codebase. Activate when user asks to "prevent emails", "remove personal data", "privacy check", "no email", or when writing/editing any code, config, or documentation files. |
| `safe-regex-authoring` | Prevent ReDoS vulnerabilities in TypeScript/JavaScript regex authoring. Activates on any task touching RegExp, .test(), .match(), .exec(), .replace(), .split() with a regex literal. Enforces length guards and unambiguous patterns. |
| `security-code-auditor` | Audit d.o.EPUB Studio code for vulnerabilities. Activate for auth, EPUB parsing, signed URL, or offline sync security reviews. Read-only analysis. |
| `shell-script-quality` | Write safe, portable shell scripts. Activate for bash/sh authoring, ShellCheck fixes, BATS test writing, and shell security patterns. |
| `skill-evaluator` | Evaluate skill output quality with grading, benchmarking, and human review. Activate for benchmarking skills, comparing versions, or validating evals. |
| `test-runner` | Execute tests, analyze results, and diagnose failures across any testing framework. Use when running test suites, debugging failing tests, or configuring CI/CD testing pipelines. |
| `testdata-builders` | Maintain deterministic builders for schema entities. Activate when authoring tests, extending testkit, or adding schema fields that affect fixtures. |
| `testing-strategy` | Plan test coverage for features. Activate for test pyramid design, Vitest/Playwright strategy, and coverage goal setting. |

## Research

| `do-web-doc-resolver` | Python implementation for resolving URLs and queries into compact, LLM-ready markdown documentation. Use when you need the Python resolver with full cascade support, quality scoring, circuit breakers, and advanced routing features. |

## Workflow

| `agent-browser` | Browser automation CLI for AI agents. Use when the user needs to interact with websites, including navigating pages, filling forms, clicking buttons, taking screenshots, extracting data, testing web apps, or automating any browser task. Triggers include requests to "open a website", "fill out a form", "click a button", "take a screenshot", "scrape data from a page", "test this web app", "login to a site", "automate browser actions", or any task requiring programmatic web interaction. |
| `cicd-pipeline` | Design and implement CI/CD pipelines with GitHub Actions, GitLab CI, and Forgejo Actions. Use for automated testing, deployment strategies, security scanning, and multi-environment workflows. |
| `cloudflare-worker-api` | Structure Worker API routes and handlers. Activate for route definition, response helpers, and typed handler patterns. Auth belongs to secure-invite-and-access. |
| `epub-rendering-and-cfi` | Implement resilient EPUB rendering and annotation anchoring per ADR-006. Activate for reader-core, TOC, locator, or highlight anchoring changes. |
| `frontend-design` | Apply frontend design best practices: layout planning, OKLCH design tokens, responsive component architecture, View Transitions, and budget validation. |
| `github-actions-version-fix` | Fix GitHub Actions "Unable to resolve action" errors using gh CLI to find correct version tags or commit SHAs. |
| `github-pr-autopilot` | Automates the entire lifecycle of a GitHub Pull Request. Use this skill when a user asks to merge a PR, resolve merge conflicts, address review comments, or fully automate PR handling end‑to‑end. Works with any repository where the GitHub CLI is authenticated. |
| `github-workflow` | Complete GitHub workflow automation - push, create branch/PR, monitor Actions with pre-existing issue detection, auto-merge/rebase when checks pass. |
| `migration-refactoring` | Automate complex code migrations and refactorings with safety patterns. Use when upgrading dependencies, migrating frameworks, modernizing languages, or performing large-scale refactorings. |
| `pr-review-fix` | Comprehensive GitHub PR review and automated fix pipeline. Takes a PR number or auto-detects from current branch, runs code review, static analysis, security audit, and quality checks, then produces a structured report and auto-fixes must-fix issues. Activate for "review PR", "fix PR issues", "PR quality check", "review and fix PR #123". |
| `pwa-offline-sync` | Design Cache Storage + IndexedDB strategy and sync queue per ADR-005. Activate for service worker, cache, or offline bug investigation. |
| `reader-ui-ux` | Build localized, accessible, premium reader/admin UI with 2026 design standards. Features OKLCH colors, View Transitions, scroll-aware components, and mutual exclusivity panels. |
| `release-management` | Cut releases, bump versions, sync changelog, and publish GitHub Releases. Activates on "cut a release", "bump version", "publish vX", "create release". |
| `secure-invite-and-access` | Implement grants, Argon2id passwords, sessions, and signed URLs per ADR-004. Activate for auth changes, access endpoints, or permission revocation. |
| `turso-schema-migrations` | Design Turso schema and write migrations. Activate for table design, migration scripts, or SQLite-compatible schema changes. |

---

*Generated by ./scripts/generate-available-skills.py*
