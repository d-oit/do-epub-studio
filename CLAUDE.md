# CLAUDE.md — Claude / Claude Code thin adapter for do-epub-studio

<!--
This file is a THIN ADAPTER on top of AGENTS.md. It must:
  1. Reference AGENTS.md for shared behavior.
  2. Add ONLY Claude-specific notes.
  3. Stay short. Do not duplicate AGENTS.md content.
  See docs/plans/068 and AGENTS.md "perf: keep agent-specific files thin".

For the full project context, see:
  - AGENTS.md                 (canonical rules)
  - llms.txt, llms-full.txt   (LLM context, structure, anti-patterns)
  - docs/plans/                    (GOAP + ADR history)
  - .agents/skills/           (curated skills)
-->

## Project summary

Web-based EPUB reader + editorial workspace. TypeScript 6 strict, React 19,
EPUB.js, DOMPurify, Zustand 5, Vite 8, Cloudflare Pages + Workers.

## Claude-specific notes

- Use the `goap-agent` skill for any multi-step task.
- Read `AGENTS.md` and `llms-full.txt` before opening a PR.
- For PRs, follow the [PR template](./.github/PULL_REQUEST_TEMPLATE.md)
  and the [PR_VERIFICATION_CHECKLIST](./.github/PR_VERIFICATION_CHECKLIST.md).
- Push to the PR head branch (`git push origin <worktree>:<pr-head> --force`)
  when the worktree branch name differs from the PR head.
- Default to opening one PR per logical change.

## Security (do not weaken)

- Reader iframe `sandbox` MUST be `['allow-same-origin']` (no `allow-scripts`).
- Worker `Content-Security-Policy` sandbox MUST be `allow-same-origin`.
- All EPUB content MUST go through `sanitizeEpubDocument` (uses an
  `ALLOWED_TAGS` allowlist, not `FORBID_TAGS`-only).
- Password hashing: Argon2id only.
- Regexes against untrusted input: `matchBounded` / `testBounded`.
