# GOAP-266 — Admin bundle-budget breach (zod 4.5.2) + main-branch audit HIGHs follow-up

Lane E (research + documentation). Docs only — no changes to
`bundle-baseline.json`, `.performance-budgets.json`, or any source file.
Numbered 266 because `plans/265-goap-issue-317.md` already occupies 265.
Leaves `plans/264-goap-pr-swarm-triage.md` to the orchestrator.

## 1. Goal

Resolve two tracked findings without silent budget erosion:

1. Admin-route entry chunk measures **104.29 KB gzip vs the 100 KB
   `lazyChunkJs` absolute budget** (absolute breach; baseline-delta passes
   trivially after regen) after the direct-merged zod 4.4.3 → 4.5.2 bump
   (commit `1fbf52a`).
2. Main-branch `Dependency Vulnerability Scan` (`pnpm audit
   --audit-level=high`) fails on fast-uri < 3.1.6 (via ajv ← commitlint dev
   chain), sharp libheif (via miniflare ← wrangler 4.125), and the js-yaml
   `maxTotalMergeKeys` bypass. Assess whether open PR #1082 (dev-deps group,
   16 updates) clears each item and recommend the minimal fix per item.

## 2. Analysis (with numbers)

### 2.1 Budget breach — attribution

- Breach: **104.29 KB gzip vs 100 KB absolute** (`lazyChunkJs` in
  `.performance-budgets.json`) = **+4.29 KB (+4.3%) over**. Per
  `docs/performance-budgets.md` + ADR-107 §3 an absolute breach requires
  refactor/code-split; a raise requires an ADR — never a silent edit.
- zod unpacked tarball grew **4.56 MB → 5.77 MB (+26%)** 4.4.3 → 4.5.2.
  Unpacked size ≠ bundled size; it counts locales, dist variants, docs.
- Official zod 4.5 sources report **no known bundle-size increase**:
  - <https://zod.dev/blog/zod-4-5> (2026-08-28): flagship `z.compile()`,
    `z.creditCard()`, `z.properties()`, `z.deepPartial()/.exactPartial()`,
    `z.validate()` fast-path, **9× schema memory-footprint reduction**,
    8 new locales (`bn ckb hi kn nn pt-BR sk tk`). Direction is runtime
    memory *down* via method memoization
    (<https://zod.dev/blog/reducing-memory-footprint>).
  - v4.5.2 (2026-08-29,
    <https://github.com/colinhacks/zod/releases/tag/v4.5.2>): docs-only +
    one `vi.spyOn` prototype-getter fix (#6488). No size-relevant change.
  - Unpacked growth is plausibly the 8 new locales + new feature modules.
- Official tree-shaking guidance (<https://zod.dev/packages/mini>): Zod Mini
  core is **2.12 KB vs 5.91 KB gzip** (realistic app 4.0 KB vs 13.1 KB);
  official line is "use regular Zod unless you have uncommonly strict
  constraints".
- Repo facts (checked, not assumed): `apps/web`, `apps/worker`,
  `packages/shared`, `packages/schema` all depend on full `zod ^4.5.2`;
  `packages/schema` (11 files) imports full `zod`, never `zod/mini`.
  **Zero files under `apps/web/src/features/admin/` import zod**
  (only `features/reader/.../NotificationPanel.tsx` does). So a
  "zod caused +4.29 KB in the admin chunk" attribution is **unproven** —
  admin routes (`BooksPage`, `GrantsPage`, `AuditLogPage`,
  `AccountSettingsPage`, dashboard) are already `React.lazy` in
  `apps/web/src/App.tsx`, so the breaching bytes live in the shared admin
  async chunk (`@simplewebauthn/browser` via `admin/mfa.ts`, `MfaSection`
  317 lines, step-up reauth, `AuditLogPage` 375 lines) or a hoisted vendor.
- **Required gate before any split work**: per-chunk bundle diff
  4.4.3-vs-4.5.2 (rollup visualizer / source-map-explorer) proving which
  module actually grew the admin chunk. Do not code-split on assumption.

### 2.2 Vuln 1 — fast-uri 3.1.5 (4× HIGH, dev chain)

- Fixed version: **3.1.6** (sibling lines 2.4.5 / 4.1.3). The four 2026-08-23
  advisories: host confusion via percent-encoded scheme
  (<https://github.com/fastify/fast-uri/security/advisories/GHSA-jqff-g426-hqxp>),
  SSRF via repeated hostname percent-decoding
  (<https://github.com/fastify/fast-uri/security/advisories/GHSA-fph4-wmhf-6fwf>),
  host confusion via skipped IDN canonicalization on scheme-relative refs
  (GHSA-5jgf-p345-68v8), SSRF via malformed IPv6 normalization
  (GHSA-f65p-4m7j-42xc). No workaround — upgrade only.
- Chain: `ajv@8.20.0` ← `@commitlint/*@21.2.2` (dev-only). npm registry
  confirms **ajv latest is 8.20.0** (same as locked) and ajv declares
  `fast-uri: ^3.0.1`, which **already admits 3.1.6** — no ajv/commitlint
  release is needed or exists.
- **Minimal fix**: lockfile-only `pnpm update fast-uri@3.1.6`. The existing
  `pnpm.overrides` floor (`fast-uri: ^3.1.5` in root `package.json`) already
  permits 3.1.6; recommend raising the floor to `^3.1.6`. Note: repo uses
  pnpm 10 — put any new/changed override in `pnpm-workspace.yaml`
  `overrides:` (canonical location) rather than extending the legacy
  `package.json#pnpm.overrides` block; a plain range bump needs no override
  at all. #1082 does **not** touch fast-uri — separate change required.

### 2.3 Vuln 2 — sharp 0.35.3 via miniflare ← wrangler 4.125

- Upstream: libheif heap-OOB write (Critical,
  <https://github.com/strukturag/libheif/security/advisories/GHSA-g89c-p67h-r497>)
  and companion GHSA-2jg2-4ch7-h545, surfaced for npm as sharp
  GHSA-rgj7-g3m4-5g8c (→ <https://github.com/lovell/sharp/releases/tag/v0.35.4>).
  **Fixed: sharp 0.35.4 (libheif 1.23.2)**; affected is everything < 0.35.4.
- **#1082 clears it**: verified in the PR lock diff — wrangler
  4.125.0 → 4.129.0 pulls miniflare → 5.20260903.0-alpha which resolves
  `sharp@0.35.4` (replacing 0.35.3). Existing `sharp: ^0.35.0` override
  already admits 0.35.4.
- **Minimal fix**: merge #1082 (covers this + js-yaml 5.x, §2.4). Fallback
  if #1082 stalls: `pnpm update sharp@0.35.4` standalone.

### 2.4 Vuln 3 — js-yaml `maxTotalMergeKeys` bypass

- Root devDep `js-yaml@5.3.0` (used load-only by
  `scripts/validate-workflows.sh`): the quadratic merge-key DoS guard
  (`maxTotalMergeKeys`, GHSA-g796-fgmg-93mv / CVE-2026-59868, fixed 5.2.0)
  is bypassed by zero-key (empty-mapping) merge sources (~1 MB → minutes of
  CPU, <https://github.com/nodeca/js-yaml/pull/797>).
- **#1082's 5.3.0 → 5.4.1 bump clears it**: 5.4.1 changelog (2026-08-26,
  <https://github.com/nodeca/js-yaml/blob/master/CHANGELOG.md#541---2026-08-26>)
  Security section = exactly the #797 fix ("count empty mappings in merge
  sequences toward `maxTotalMergeKeys`") plus a merge-sequence hard-limit
  of 100. Caveat: 5.4.0 carries breaking changes (flattened AST node
  styles, `sortKeys` rewrite, scalar restyle) — risk is low for load-only
  CI usage, but the #1082 validation run must include
  `./scripts/validate-workflows.sh`.
- Transitive copy: `js-yaml@4.3.1` via cosmiconfig ← commitlint has the old
  `maxTotalMergeKeys` backport (4.3.0) but **predates** the #797 fix.
  **4.3.2** (2026-08-26, "Backport merge limits from v5.4.1", puzrin —
  <https://github.com/nodeca/js-yaml/compare/4.3.1...4.3.2>) is the v4 fix.
  **Minimal fix**: parent-scoped bump/override of the cosmiconfig edge to
  `js-yaml@4.3.2` (same pattern as the repo's existing scoped overrides),
  or `pnpm update js-yaml@4.3.2` if the range admits it.

## 3. Options

- **Option A — ADR budget raise (100 → ~105 KB).** Pros: unblocks CI fast.
  Cons: violates ADR-107 §3 default (absolute breach ⇒ refactor), ratchets
  the precedent set by GOAP-230/ADR-234 raises, hides an unattributed +4.3%
  with no root cause. Requires a written ADR with evidence the floor is
  irreducible — evidence that does not exist yet (§2.1).
- **Option B — admin code-split (recommended).** Candidates, to confirm
  against the §2.1 bundle diff (largest-first):
  1. `dynamic import('@simplewebauthn/browser')` inside `admin/mfa.ts`
     (`performPasskeyAuth/Enroll`) so non-passkey admin loads skip the
     ceremony lib (currently statically pulled via `MfaSection` ←
     `AccountSettingsPage`; `AdminLoginPage` also imports it statically).
  2. Split `AuditLogPage.tsx` (375 lines, heaviest admin page) table/filter
     dependencies behind its already-lazy route boundary.
  3. Defer `MfaSection` recovery-code UI below the fold of
     `AccountSettingsPage`.
  4. **Only if the diff implicates zod**: convert the single web-client
     direct import (reader `NotificationPanel`) to `zod/mini` or drop it;
     keep full `zod` in `packages/schema` (worker-side validation).
- **Decision recommendation: B, time-boxed, measurement first.**
  Step 1 (no code): bundle diff to name the +4.29 KB module(s). Step 2:
  cheapest split from the candidate list. Step 3: only if the post-split
  floor still exceeds 100 KB, pursue Option A via a proper ADR citing the
  diff — never a silent budget edit.

## 4. Tracking-issue draft bodies

### Draft 1 — `fix(web): admin chunk exceeds 100KB absolute budget after zod 4.5.2`

> Admin-route entry chunk measures 104.29 KB gzip vs the 100 KB absolute
> `lazyChunkJs` budget after zod 4.4.3 → 4.5.2 (direct merge `1fbf52a`).
> Baseline-delta passes after regen; absolute does not. Per ADR-107 §3 this
> needs refactor/code-split, not a budget raise (raise needs an ADR).
> Note: zod 4.5 release notes document no bundle-size increase (memory
> footprint down 9×); admin code has zero direct zod imports and admin
> routes are already lazy — attribution is unproven.
> Acceptance: (1) bundle diff 4.4.3-vs-4.5.2 naming the grown module(s);
> (2) cheapest split from GOAP-266 §3 applied; (3) `check-bundle-budget`
> green with budgets untouched. If floor stays >100 KB, file an ADR (Option
> A) with the diff as evidence.Refs: GOAP-266, ADR-107 §3,
> docs/performance-budgets.md, <https://zod.dev/blog/zod-4-5>.

### Draft 2 — `chore(deps): clear pnpm audit HIGHs (fast-uri, sharp, js-yaml)`

> `pnpm audit --audit-level=high` fails on main: fast-uri 3.1.5 (4× HIGH
> GHSA, ajv ← commitlint dev chain), sharp 0.35.3 libheif RCE chain (GHSA
> wrapping GHSA-g89c-p67h-r497/GHSA-2jg2-4ch7-h545), js-yaml
> `maxTotalMergeKeys` empty-source bypass (#797).
> Plan: merge #1082 (verified: pulls sharp 0.35.4 via miniflare
> 5.20260903.0-alpha; js-yaml → 5.4.1 with the #797 fix) + run
> `./scripts/validate-workflows.sh` for the 5.4.0 breaking changes; then
> lockfile-only `fast-uri@3.1.6` (ajv 8.20.0 range `^3.0.1` already admits
> it — no ajv release needed) and scoped `js-yaml@4.3.2` for the
> cosmiconfig edge (backport of the 5.4.1 merge limits).
> Acceptance: `pnpm audit --audit-level=high` green on main. Refs: GOAP-266.

## 5. Sources

- <https://zod.dev/blog/zod-4-5> · <https://zod.dev/blog/reducing-memory-footprint> ·
  <https://zod.dev/packages/mini> · <https://github.com/colinhacks/zod/releases/tag/v4.5.2>
- <https://github.com/fastify/fast-uri/security/advisories/GHSA-jqff-g426-hqxp> ·
  <https://github.com/fastify/fast-uri/security/advisories/GHSA-fph4-wmhf-6fwf>
- <https://github.com/strukturag/libheif/security/advisories/GHSA-g89c-p67h-r497> ·
  <https://github.com/lovell/sharp/releases/tag/v0.35.4>
- <https://github.com/nodeca/js-yaml/blob/master/CHANGELOG.md> ·
  <https://github.com/nodeca/js-yaml/pull/797> ·
  <https://github.com/nodeca/js-yaml/compare/4.3.1...4.3.2>
