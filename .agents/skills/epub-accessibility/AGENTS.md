# AGENTS.md — epub-accessibility

Repo-specific invariants:

- EPUB Accessibility 1.1 is the only normative accessibility baseline; 1.2 (CR draft, 2026-09-12) is a signal only. Same for EPUB 3.3 vs 3.4.
- Accessibility evidence is revision-scoped and recomputed when bytes change; never reuse stale evidence.
- Reports must say they are evidence, not certification, and must separate publication content, metadata claims, and reader-UI findings.
- Automated axe results apply to app-owned UI only — never to EPUB content inside the sandbox; manual content review is required for content claims.
- Never invent assistive-tech evidence; record actual environments only.
- New accessibility UI strings must land in `apps/web/src/i18n/en.ts` plus all 12 non-English locale files in the same change (typechecked parity).
- Vitest under `flock -w 900 /tmp/vitest.global.lock`.
