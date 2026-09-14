# scripts/ AGENTS.md

Guidance specific to authoring and testing scripts in `scripts/`.

## BATS stub layering

- **Stub the lowest-level boundary, not the function under test.** A setup that stubs a high-level function (e.g. `verify_tag_commit`) silently replaces it in every test — lower-level tests then "pass" or "fail" against the stub, not the real logic (GOAP-270: tests 11–13 exercised a `return 0` setup stub instead of the real verifier). Stub the outermost boundary of the unit (network/IO edge, e.g. `resolve_tag_commit`) so per-function tests exercise real logic; override stubs per-test only when that test targets the stubbed seam itself.
