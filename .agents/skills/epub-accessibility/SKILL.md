---
name: epub-accessibility
description: >
  Use for EPUB Accessibility 1.1 vs 1.2 checks, metadata claims, accessibility
  evidence wording, and accessible reading UI decisions. Not for WCAG app-UI
  audits (see accessibility-auditor) or conformance evidence (see epub-validation).
category: quality
allowed-tools: Read Write Edit Glob Grep Bash
version: "1.0.0"
license: MIT
---

# Skill: `epub-accessibility`

Purpose: evaluate and report EPUB accessibility evidence — stable vs draft standards, metadata claims, machine-checkable structural advisories, manual review statuses — without overstating conformance.

## When to Use

**Activate when:**
- Reading/writing accessibility metadata from OPF (`packages/reader-core/src/epub-accessibility.ts`).
- Framing accessibility report wording or any "accessible" claim for a book.
- Deciding EPUB-specific reading-UI accessibility needs (contrast, reflow, zoom, keyboard, RTL, media overlays).
- Changing the standards baseline language (EPUB Accessibility 1.1 vs 1.2, EPUB 3.3 vs 3.4).

**Activate when (extension):**
- Audit of app-owned UI (WCAG 2.1/2.2 AA) → `accessibility-auditor`.
- Reading UX design tokens/UI → `reader-ui-ux`.
- Conformance evidence pipeline → `epub-validation`.

## Inputs & Authority Hierarchy

1. **ADR-1017** (`plans/1017-adr-epub-conformance-and-evidence.md`) — normative: EPUB Accessibility 1.1 (stable) vs 1.2 (Candidate Recommendation Draft, 2026-09-12) are separate signals; evidence is revision-scoped; reports state they are not certification; never invent assistive-tech evidence.
2. **Epub matrix**: `docs/epub-capability-matrix.md` — standards status + evidence classification (status, observed behavior, fixture, engine/version).
3. **Parser**: `packages/reader-core/src/epub-accessibility.ts` (`parseAccessibilityFromOpf`) and `epub-accessibility.test.ts`.
4. **i18n**: report strings must be added to `apps/web/src/i18n/en.ts` and ALL locale files (`ar de es fr hi it ja ko nl pt ru zh`) in the same change — typecheck enforces parity.

## Safe CLI-First Workflow

1. Separate evidence types: publication content findings vs reader-UI findings vs metadata claims. Never conflate them in one "accessible" verdict.
2. Machine-checkable items come from the package document (metadata, structure advisories); manual-review statuses tracked distinctly; remediation state never inferred from EPUBCheck severity alone.
3. Recompute evidence when revision bytes change; never reuse stale evidence for a new revision.
4. Report wording: state it is evidence, not certification; avoid "passes accessibility" claims; say which baseline (1.1 stable) and flag 1.2 as draft signal only.
5. App-UI accessibility claims must come from an axe-based audit of app-owned UI — never from automated checks of EPUB content inside the sandbox.
6. Manual evidence is recorded as actual environment/results; never invent NVDA/VoiceOver sessions.

## REQUIRED Verification Commands

```bash
cd /home/doit/git/do-epub-studio   # or the active worktree
# Accessibility metadata parser tests
flock -w 900 /tmp/vitest.global.lock pnpm --filter @do-epub-studio/reader-core exec vitest run src/__tests__/epub-accessibility.test.ts
# Standards status drift check (matrix vs ADR baselines)
node scripts/check-standards-status.mjs
# i18n parity (new strings must exist in all locale files; typecheck enforces it)
node scripts/check-loc.mjs
bash scripts/validate-skill-format.sh && bash scripts/validate-skills.sh && node scripts/check-agent-sync.mjs
```

## Expected Outputs

- Revision-scoped accessibility evidence: metadata claims, structural advisories, manual-review statuses, and reader-UI findings — stored distinctly.
- Wording that names the baseline, flags draft signals, and explicitly says it is not certification.
- New UI strings present in the English and all 12 non-English locale files.

## Example Task

"Add a 'structural navigation' advisory to the accessibility report that is derived from the nav document, and cover it in `epub-accessibility.test.ts`."

## Reference Files

- `references/guide.md` — evidence taxonomy, baseline dating, and i18n mechanics.
- `plans/1017-adr-epub-conformance-and-evidence.md`
- `docs/epub-capability-matrix.md`
- `packages/reader-core/src/epub-accessibility.ts`
- `apps/web/src/i18n/en.ts`

## Rationalizations

| Rationalization | Reality |
|-----------------|---------|
| "EPUBCheck passed, so the book is accessible." | EPUBCheck is conformance, not accessibility. Accessibility evidence is a separate revision-scoped report with its own claims. |
| "The tool says 1.2 compliant, so we can claim EPUB Accessibility 1.2." | 1.2 is a Candidate Recommendation Draft (2026-09-12); 1.1 is the stable baseline. Draft signals are not normative claims. |
| "Axe found no issues, so the book is accessible." | axe covers app-owned UI only, never EPUB content inside the sandbox; content requires manual review. |
| "We observed a screen reader pass — record it as NVDA/VoiceOver." | Only record actual environments used; never invent names or equate automated passes with conformance. |

## Red Flags

- [ ] Report claims certification or asserts a book "passes accessibility".
- [ ] 1.2/3.4 draft signal presented as normative.
- [ ] Metadata claim stated without the underlying package-document evidence.
- [ ] Reader-UI findings mixed into publication-content findings (or vice versa).
- [ ] Accessibility strings added only to en.ts, breaking i18n parity.
- [ ] Automated (axe) result used as evidence for content accessibility.
