# AGENTS.md — epub-security-ingest

Repo-specific invariants:

- Every ingest path — including upload, preview, and re-validation — must pass `validateArchive` before any parsing/rendering. There is no "trusted upload" exception.
- Archive limits are security constants; changing them requires a security review and must update `archive-validator.test.ts` fixtures in the same change.
- Default external policy is block-all; a scoped allowlist requires explicit approval and a test.
- The iframe sandbox is `allow-same-origin` only — never add `allow-scripts`/`allow-same-origin`+`allow-scripts` combos.
- Bounded regex is non-negotiable: `matchBounded`/`testBounded` from `@do-epub-studio/shared` everywhere untrusted text is matched.
- Run `node scripts/check-untrusted-ingest-sinks.mjs` after touching any skill/script/workflow that consumes untrusted text.
- Vitest under `flock -w 900 /tmp/vitest.global.lock` — one vitest at a time.
