# GEMINI.md — Gemini / Jules thin adapter for do-epub-studio

<!--
This file is a THIN ADAPTER on top of AGENTS.md. It must:
  1. Reference AGENTS.md for shared behavior.
  2. Add ONLY Gemini/Jules-specific notes.
  3. Stay short. Do not duplicate AGENTS.md content.
  See plans/068 and AGENTS.md "perf: keep agent-specific files thin".

For the full project context, see:
  - AGENTS.md                 (canonical rules)
  - llms.txt, llms-full.txt   (LLM context, structure, anti-patterns)
  - plans/                    (GOAP + ADR history)
  - .agents/skills/           (curated skills)
-->

## Project summary

Web-based EPUB reader + editorial workspace. Cloudflare Pages + Workers
backend. TypeScript 6 strict, React 19, EPUB.js, DOMPurify, Zustand, Vite 8.

## Gemini / Jules specific notes

- **Forbidden in this project**: `allow-scripts` in the reader iframe sandbox,
  bcrypt/scrypt (use Argon2id), direct DOM mutation outside React, raw
  `console.*` on critical paths (use `logClientEvent`).
- **Always read first**: `AGENTS.md`, `llms-full.txt`, and the most recent
  `plans/068-*.md` for current open-issue context.
- **Default to the goap-agent skill** for any multi-step task.
- **Prefer conventional commit messages** (the commit-msg hook enforces this).
- **Push to the PR head branch**, not the worktree branch. The pattern
  `git push origin <worktree>:<pr-head> --force` is required when the two
  branch names differ.

## Sandbox

The `sandbox/` in the worker `Content-Security-Policy` for EPUB assets
MUST NOT include `allow-scripts`. The DOMPurify sanitizer
(`packages/reader-core/src/sanitizer.ts`) MUST use an `ALLOWED_TAGS`
allowlist (not `FORBID_TAGS`-only). Reviewers will reject PRs that
weaken either of these.
