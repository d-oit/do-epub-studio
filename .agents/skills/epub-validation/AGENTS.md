# AGENTS.md — epub-validation

Repo-specific invariants:

- EPUBCheck is pinned to 5.4.0 with a fixed SHA-256 in `scripts/check-epub-fixtures.mjs`. Never bump the validator without updating both the pin and the idempotency tests.
- `validateArchive` (shared) is the security boundary — EPUBCheck findings must never replace it, and safety rejection must stay hard.
- Report JSON is bounded and uses normalized severity/code/location/path with safe messages; never persist raw untrusted paths.
- Idempotency key is `(revision, sha256, validatorVersion)`; changing bytes or validator version changes the result.
- Report wording must state it is evidence, not certification (see `epub-accessibility` for claim wording).
- Run vitest under `flock -w 900 /tmp/vitest.global.lock` — one vitest at a time repo-wide.
