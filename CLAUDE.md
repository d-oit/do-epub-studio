# CLAUDE.md — Claude / Claude Code thin adapter for do-epub-studio

<!--
THIN ADAPTER on top of AGENTS.md. Must stay short. See plans/068.
For canonical rules, read `AGENTS.md`.
For LLM context, read `llms.txt` and `llms-full.txt`.
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
