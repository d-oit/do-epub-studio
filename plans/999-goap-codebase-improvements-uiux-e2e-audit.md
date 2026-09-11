# GOAP-999: Reader–Creator Collaboration, Editorial Assistance, Responsive UX and E2E

**Status:** STATIC AUDIT COMPLETE — PRODUCT IMPLEMENTATION NOT STARTED
**Date:** 2026-09-10
**Type:** GOAP audit backlog (documentation deliverable; no application/infrastructure changes authorized)
**Companion contract:** `plans/999-adr-reader-creator-editorial-contract.md` (ADR-999, Proposed)
**Related:** PRODUCT.md, DESIGN.md, ADR-004 (auth/access), ADR-005 (offline sync), ADR-006 (EPUB rendering/CFI), ADR-075 (tenant isolation), ADR-262 (local-only AI policy — proposed amendment), GOAP-254, GOAP-255, `analysis/goap-254-audit-evidence.md`

## 1. Context and plan critique

The product's central workflow is: ordinary EPUB reading → optional permission-controlled reader comments and suggestions → creator review and use of that feedback. Optional grammar, spelling, story and logic assistance is grounded in retained references and the book's own style, avoiding generic AI prose. All viewport classes and end-to-end journeys are in scope.

The initial audit plan prioritized styling/testing infrastructure before specifying reader-to-creator collaboration. Its missing contracts were feedback permission, creator review lifecycle, passage/reference provenance, authorial-style preservation, uncertainty handling and history scope. This backlog is reorganized around ordinary reading → authorized feedback → creator review → optional grounded assistance; CSS and E2E improvements support those journeys rather than substitute for them.

Confirmed product choices (user-directed, recorded here and in ADR-999 §4):

- Inspect repository Git history only; no manuscript-history/version-control feature.
- Local-first assistance with explicit cloud opt-in (amends GOAP-262's categorical prohibition on book-text network processing; local-first/default-off remains).
- Book-scoped creators, not every admin treated as a creator.
- Editorial feedback private to its submitting reader and assigned creator(s); existing shared discussion remains distinct.

This is a documentation deliverable. No application/infrastructure changes, dependency installation, deployment, spending or publishing are authorized by this record. Planning remains read-only until execution approval.

## 2. Evidence and limitations

- `PRODUCT.md` describes a private EPUB reader for individuals/small teams, with annotations, insights, admin management and offline reading. `DESIGN.md` specifies editorial typography, OKLCH light/dark/sepia tokens, WCAG 2.2 AA, 320 CSS-pixel reflow and a stricter project-level 44px control target.
- `plans/254-goap-uiux-modernization-master-plan.md` and `plans/255-goap-epub-sparkle-uiux-port.md` remain IN PROGRESS and contain historical execution/provider notes. Their current text is not proof of remaining work; reconciled against source in §8, preserving the deferred public-root route decision.
- The previous session-local `missing-plan-tasks-plan.md` is reference only. This audit is a plans-folder refresh, not its implementation/PR workflow. It is not executed here.
- Existing package commands in root `package.json` include `test:e2e:smoke`, `test:e2e`, `bundle:budget:enforce` and `verify`; no build/test/server has been run in this audit.
- Four read-only scouts owned reader/library/settings UX; admin/auth/catalog/help UX; core/offline/feature opportunities; E2E/CI coverage. Main owned research, synthesis and plan/index edits.
- `analysis/goap-254-audit-evidence.md` records prior implementation and test results; attributed here as historical, not fresh passes. It also records unresolved sepia contrast and shared-package CSS discovery risks.
- Static OKLCH ratio calculations in UI-01 are token calculations, not rendered axe results. Static source-risk findings (REL-01, SEC-01) await runtime reproduction during implementation. Runtime/E2E claims require the verification matrix in §9.

## 3. Current implementation and Git evidence

- `App.tsx:138–215` nests catalog/library/settings in AppShell, calls `useSyncStatus`, and retains role-aware root redirects. Persistent navigation is present, not a new feature. Admin/auth/reader/help/404 remain independently laid out.
- `apps/worker/src/auth/middleware.ts:32–79` (`requireAuth`): resolves book grant and recomputes reader capabilities per request; server-side boundary for reader contribution rights.
- `packages/schema/src/schemas/grants.ts:4–21` already supports optional comments (`CreateGrantSchema.commentsAllowed`, default false). `packages/shared/src/dtos.ts:54–62` has no creator-review capability. `auth/account.ts:13–24` declares global admin/editor/reader roles, but none is a book-scoped creator assignment.
- `apps/worker/src/routes/comments.ts:34–45,73–256` is a shared-or-own reader discussion API (comment permission on POST; ownership checks on PATCH/DELETE); it is not a private reader/creator review API. `AdminBookResponsesPage` in `App.tsx` loads BooksPage, not a responses inbox.
- `packages/schema/migrations/0001-initial-schema.sql:18–74`: `books` lacks an owner column; `book_access_grants.invited_by_user_id` is null in practice; `book_files` (lines 36–50) already has `id`, `book_id` and nullable `sha256`. Reuse that evidence identity without promising manuscript version control.
- `packages/reader-core/src/ai/types.ts:1–109` and `apps/web/src/lib/ai-plugins.ts:1–38`: client-side plugin registry, consent gate and local-first contract. Existing AI code is only a consent-gated summarization plugin with no inference engine wired (`ai-plugins.ts:27`, `ai/types.ts:71–94`); no automatic rewrite or working grammar/story analysis is claimed.
- `apps/web/src/features/reader/ReaderPage.tsx:172–182` and `components/annotations/AnnotationToolbar.tsx:9–43`: reader selection discovery and passage-action dispatch; UI anchor for touch reachability, passage context and private submission.
- `apps/web/src/styles/globals.css:208–248` confirms a dark sepia surface (`oklch(25% 0.05 85)`) paired with dark foreground (`oklch(0.28 0.04 55)`); source-backed contrast candidate requiring rendered measurement.
- `apps/web/src/styles/globals.css:6–9` imports Tailwind without explicit `@source`; `packages/ui/package.json:6–7` exports source files; `packages/ui/src/button.tsx:29–54` owns utilities outside `apps/web`.
- Git history inspected this session: `8534719` delivered executable-plan backlog (#1100); `ab3a736` delivered core navigation (#1099); `d2c19b2` delivered dependency/CI remediation (#1097) — landed context, not new work. `f223b39` introduced the AI plugin/consent architecture (#1058); `130bce7` addressed frontend/backend sync schema mismatches (#896) — history explains reusable seams, not proof that editorial assistance or private creator review exists.
- Numbering policy ADR-083 is monotonic across indexed numbers. Highest existing numbered record is 998; 999 was free at audit time and is used here. Historical 998 and the existing duplicate 267 topics are preserved, not renumbered.
- Fresh read-only check at audit time: `node scripts/check-adr-index.mjs` passed, tracking 79 ADR numbers. Its implementation checks file existence only for Accepted rows, so the new GOAP path is verified separately in §9.

## 4. Product contract (summary; normative text in ADR-999 §4)

- **COL-01 — Ordinary reading and book-scoped creator rights.** Reading primary; `commentsAllowed=false` default; explicit per-book creator assignment (canonical `users.id`/`books.id`); new `/creator` routes; assignment enforced per endpoint; revocation removes review access without changing reading grants.
- **COL-02 — Private editorial channel with explicit review states.** New `open`/`accepted`/`declined`/`resolved`/withdrawn lifecycle beside existing shared discussion; only submitter + assigned creators see items; `accepted` means editorial agreement, NOT a modified EPUB; no automatic file replacement or publishing.
- **COL-03 — References and the book's own style.** Retain `bookId`, source `book_files.id`, available SHA-256, `chapterRef`, CFI, exact quote + prefix/suffix beside `MultiSignalLocatorSchema`; per-book creator-approved style profile, glossary and notes; `source changed`/`anchor unresolved` states; evidence binding is not version history.
- **AI-01 — Four review categories, not a generic rewrite button.** Spelling/grammar/story/logic as structured, cited, uncertainty-marked findings; local drafts until saved/submitted; no whole-book rewrite command.
- **AI-02 — Local-first execution, explicit cloud disclosure.** Default-off consent; real-engine qualification milestone; cloud is an explicit alternate action with per-book permission + per-dispatch confirmation, never a fallback; secrets server-side.
- **AI-03 — Anti-slop and provenance acceptance corpus.** Eight deterministic input/output properties (§6, items 1–8); real engine runs + human creator review for style; fixtures labeled and UI/error-scoped only.

Repository Git history is inspected for decisions only. No manuscript revision browsing, Git storage, branching or merge tools are planned.

## 5. Prioritized backlog

Evidence classes: **confirmed defect** (source-verified) · **confirmed gap** (source-verified absence) · **static token defect** (computation, rendered check pending) · **source-backed fragility** (source-verified, reproduction pending) · **static source risk** (source-verified path, runtime reproduction pending).

### UI-01 — P1: Correct sepia card contrast at the shared token

- **Evidence:** static token defect; rendered browser check pending. `apps/web/src/styles/globals.css:208–248` defines sepia surface `oklch(25% 0.05 85)` with dark foreground; `apps/web/src/features/library/BookCard.tsx:14–64` consumes `bg-surface`, default foreground, author `text-foreground-muted` and eyebrow metadata. Static OKLCH-to-linear-sRGB calculations this audit: primary/surface 1.09:1, secondary/surface 1.60:1, muted/surface 2.67:1. Token calculations, not rendered axe results.
- **Chosen change:** set sepia `--color-surface: var(--color-background-secondary)`; reuse the existing warm light surface (`oklch(95% 0.04 85)`), no per-card overrides or new colors. Static expected ratios become 12.73:1, 8.67:1 and 5.19:1. Light/dark definitions unchanged. No broader palette redesign.
- **Reuse/dependencies:** existing semantic token layer; verify after applying sepia to populated library/catalog/admin cards and reader panels.
- **Acceptance (observable):** computed foreground/background pairs on real cards and reader panels: normal text ≥4.5:1, large text ≥3:1.

### UI-02 — P1: Make shared UI Tailwind discovery explicit

- **Evidence:** source-backed build fragility, fresh production reproduction pending. `apps/web/src/styles/globals.css:6–9` (import without explicit sources); `packages/ui/package.json:6–7` (source-file exports); `packages/ui/src/button.tsx:29–54` (utilities outside `apps/web`). `analysis/goap-254-audit-evidence.md:28–37` records a prior 28px-control failure that disappeared when app files happened to include `min-h-11`.
- **Chosen change:** register `@source "../../../../packages/ui/src";` after the Tailwind import in `globals.css`; retain complete static classes in primitives, no safelist or dummy application class.
- **Reuse/dependencies:** existing Tailwind v4 scanning; integration owner coordinates with UI-01 (global CSS) and i18n.
- **Acceptance (observable):** a web-package production build emits the real shared Button/Input/Modal styles and rendered control geometry stays correct without duplicate app usage. Any newly effective shared utility conflict is fixed as a source defect, not by removing source registration or raising bundle budgets.

### REL-01 — P1: Protect encrypted offline queues from unauthenticated drains

- **Evidence:** static source risk, runtime reproduction pending. `sw.ts:200–211` imports the page sync module during Background Sync; `offline/db.ts:106–160` obtains its encryption key from the page auth store and returns a partial row when encrypted data has no key. `offline/sync.ts:322–331` falls through to success for an unknown/missing item type; the success branch removes the queue item. The observed source includes a direct potential deletion path; do not repeat any unverified "retry corruption" mechanism as established.
- **Chosen change:** only an authenticated page drains the session-encrypted queue; the SW notifies available clients without receiving/persisting session tokens. No client/key means retain queued data for the next authenticated foreground session and accurately report sync pending. Encrypted rows without a decryptable key must not be returned as valid payloads; unrecognized queue types must not be acknowledged as success. Reuse the existing sync engine and online listener, not a second SW authentication system.
- **Reuse/dependencies:** existing sync engine, online listener, session key derivation.
- **Acceptance (observable):** SW-like no-storage/no-key execution leaves the encrypted row intact; subsequent authenticated foreground sync submits it exactly once. Token/account switches never expose another account's draft.

### REL-02 — P1: Offline feedback creation and retry must preserve drafts

- **Evidence:** confirmed gap in `useAnnotationHandlers.ts:125–165` — comment creation calls the API, removes the optimistic placeholder and throws on failure; only status updates have an explicit offline path (`168–205`). Existing offline persistence/queue utilities are reusable, but their presence is not evidence of offline comment creation.
- **Chosen change:** extend the private feedback workflow after COL-01/02 with durable owner-scoped drafts and explicit `draft`, `pending`, `sent`, `failed` delivery states separate from editorial disposition. Queue authorized offline submissions; preserve human text, suggestion replacement, references and source identity. Network failure is retryable; validation/403 failures remain drafts with an actionable error, never a silently queued forbidden write. Revalidate access/capability on replay. Stable mutation identity + server-side replay deduplication for new feedback creation; POST retries are not assumed idempotent.
- **Reuse/dependencies:** COL-01/02 contracts; existing offline persistence/queue utilities; `requireAuth` capability resolution.
- **Acceptance (observable):** compose offline → reload → same private draft and provenance; reconnect → exactly one creator-visible item; lose contribution rights before replay → no server item, no peer disclosure, intelligible blocked-delivery state. Losing book access locks cached private content rather than displaying it under a different user.

### REL-03 — P2: Present actual progress conflicts, not fabricated copies

- **Evidence:** confirmed source defect in `offline/sync.ts:358–395` — a 409 calls `resolveConflict` with the local payload as both versions and identical timestamps; the manual branch removes the queue item (`177–187`).
- **Chosen change:** fetch the actual remote progress before creating a conflict; keep the local version durably until resolution. Preserve existing resolver/user-choice semantics; no new automatic "latest wins" behavior. Unavailable remote fetch retains pending state.
- **Reuse/dependencies:** existing conflict resolver and user-choice UI.
- **Acceptance (observable):** differing local/remote positions appear as different choices; choosing local resends successfully; failures cannot acknowledge unsent progress.

### SEC-01 — P1: Apply contribution permission consistently

- **Evidence:** source-backed gate discrepancy — `apps/worker/src/routes/comments.ts` POST checks canComment; PATCH/DELETE check book access and ownership but not canComment.
- **Chosen change:** new private channel mutation policy — submit/reply/edit/withdraw requires current reader contribution permission; creator dispositions/replies require current creator assignment. Server-side checks, including replay; frontend is only an affordance gate. Review existing shared-comment PATCH/DELETE against that contribution policy using the existing same-book/cross-book capability resolution, not a copied stale session flag.
- **Reuse/dependencies:** `requireAuth` (`middleware.ts:32–79`); COL-01 assignment model.
- **Acceptance (observable):** a read-only session cannot mutate an old own comment via direct API call. (Not claimed as a demonstrated exploit: grant updates also revoke sessions, so reproducibility depends on the actual valid-session setup.)

### UI-03 — P1: Make the navigation drawer keyboard- and RTL-correct

- **Evidence:** confirmed gap in `components/navigation/Drawer.tsx:14–105` — Escape and scroll locking present, but no focus move/trap/restore; physical left/right positioning.
- **Chosen change:** reuse the focus lifecycle from `packages/ui/src/modal.tsx:19–49` / its existing focus-trap hook; preserve drawer presentation and `lg` breakpoint; add correct modal semantics and logical inline-start placement/borders. Resizing into desktop closes/unlocks the hidden drawer.
- **Reuse/dependencies:** existing modal focus-trap hook; `lg` breakpoint contract.
- **Acceptance (observable):** keyboard opens the drawer; Tab/Shift+Tab stay within; Escape returns focus to the exact trigger; background cannot receive interaction; Arabic opens from inline-start; reduced-motion preference respected. Verified after exit animation as well as while open.

### UX-01 — P2: Fix audit refresh without discarding context

- **Evidence:** confirmed source issue in `features/admin/AuditLogPage.tsx:218–222` — invalidate cache then `setPage(p => p)` does not request a re-render.
- **Chosen change:** give refresh a real invalidation/render trigger while preserving page/filters; show pending status.
- **Reuse/dependencies:** existing audit query/filter state.
- **Acceptance (observable):** initial audit rows → backend returns a new row → Refresh displays that row without changing filters. Actor/entity columns retained (creator/support investigations need them); use accessible table scrolling or an equivalent labeled detail, not column removal.

### UX-02 — P2: Bring help controls into normal page flow

- **Evidence:** confirmed gap in `features/help/HelpPage.tsx:13–21` — fixed physical-right theme/locale controls with compensating top padding.
- **Chosen change:** reuse `components/LoginHeader.tsx` rather than a new header. Add concise localized help explaining reading rights, private feedback versus shared discussion, creator review states and optional assistance once those features exist.
- **Reuse/dependencies:** LoginHeader; i18n coverage for every new string.
- **Acceptance (observable):** at 320px, 812×375 and Arabic — controls/text do not overlap; all actions reachable by keyboard.

### E2E-01 — P1: Replace false confidence with consumer-observable checks

- **Evidence:** confirmed weak tests — `apps/tests/reader-progress.spec.ts:88–90` is an empty test; its first test changes a mock variable and waits for telemetry rather than proving restored reading position.
- **Chosen change:** replace the empty case with a real reader navigation → persistence → offline reload journey asserting the restored passage/position; telemetry may synchronize the test but cannot be the only proof. Strengthen the audited false-pass cluster in `edge-cases.spec.ts` (offline test checks only title), `offline-reader.spec.ts` (queue assertion conditional on store discovery), `a11y-advanced.spec.ts` (focus tests do not establish named behavior), `viewport-regression.spec.ts` (conditional focus check). Keep deterministic fixtures; require expected UI/state to exist; assert the promised outcome.
- **Reuse/dependencies:** existing Playwright fixtures; VIEWPORT_MATRIX sizes.
- **Acceptance (observable):** no vacuous empty tests remain in `reader-progress.spec.ts`; each strengthened spec fails if the named behavior regresses. No source-text/class assertions, implementation snapshots, broad catch/skip branches, or telemetry-only checks.

### E2E-02 — P1: Separate mocked-app, real-backend and real-SW evidence

- **Evidence:** confirmed lane conflation — `cloudflare-login.spec.ts` performs live requests while carrying `@smoke`; local Vite has no worker and missing-backend failures are already documented.
- **Chosen change:** retain live test assertions unchanged; give that entire spec a dedicated live-backend project/job requiring `CLOUDFLARE_PREVIEW_URL` and seeded credentials, excluded by file from local/mock project selection. Selecting the live lane without prerequisites fails setup clearly, not silently skips. Do not remove assertions, weaken expectations, or edit known duplicate-copy assertions for green.
- **Reuse/dependencies:** existing Playwright projects; `pwa-chromium` SW-enabled lane.
- **Acceptance (observable):** local smoke lane passes without live credentials; live lane runs only with prerequisites; `pwa-chromium` fails if expected SW activation/control is absent — unexpected skipped offline tests fail the run. Live results recorded independently from mocked UI results; CI-required checks preserved, not hidden. The live lane uses a controlled seeded preview, never production user data.

## 6. Route and viewport coverage

Current route inventory from `App.tsx:158–214`; actual route destinations are used, not a test's title. `/` redirects and cannot serve as proof for `/catalog`.

| Surface | Required coverage |
| --- | --- |
| `/`, `/index.html` | Guest, book reader, admin redirects; do not introduce a landing page |
| `/login`, `/admin/login`, `/admin/recover` | Loading, invalid/expired access, recovery, keyboard, password controls, locale; preserve live-backend prerequisite |
| `/catalog` | Direct navigation, search/filter/page, empty/error, long titles and covers |
| `/library`, `/settings` | Populated/empty/loading/append-error; named settings, theme persistence, sync/install capability states |
| `/read/:bookSlug` | Ordinary read-only reading; TOC/search/progress/bookmarks; authorized feedback composer, source/reference context, denied/pending/error; reflowable and fixed-layout EPUBs |
| `/admin`, `/admin/books`, `/admin/grants`, `/admin/books/:bookId/grants` | Book/grant management, creator assignment and contribution permission; modal focus, narrow tables/actions |
| `/admin/audit`, `/admin/account` | Refresh/filters/export; account forms and expiry/step-up boundaries without modifying auth policy |
| `/help`, catch-all 404 | Actual page load, useful recovery path, keyboard and locale — not only link href |
| Proposed `/creator`, `/creator/books/:bookId/feedback` | Assigned/unassigned/removed access, list/detail/reply/disposition, references, selected export, empty/loading/error/conflict |

Viewport matrix — all nine existing `VIEWPORT_MATRIX` sizes: 320×568, 375×812, 390×844, 640×960, 768×1024, 1024×768, 1440×900, 1920×1080, 812×375. Boundary widths 639/640, 767/768, 1023/1024 at 900px height; portrait-to-landscape and modal/drawer open/resize transitions. This covers viewport classes and breakpoints, not every device.

- Basic ready-state/reflow/keyboard checks at all nine sizes per route family; full collaboration journey at 320, 768, 1440 and 812×375.
- At 320/768/1440 additionally: light/dark/sepia, Arabic RTL, long-string locale (German), reduced motion, 200% text enlargement. Desktop browser zoom to 320 CSS-pixel effective width; distinguish true zoom from deviceScaleFactor.
- Selected passage and composer must remain visible above a mobile software keyboard on an actual device; emulator geometry alone is not proof.
- Wait for final route content before measuring. Inspect document AND main/panel scrollWidth plus action bounding boxes; overflow clipping can hide problems. Table/EPUB fixed-layout exceptions must not exempt surrounding controls or feedback text.
- Project controls target 44×44px; report WCAG AA's 24px rule/exceptions separately. Focus visibility, focus-not-obscured, skip link, return-to-trigger, final control reachability. Axe scans include opened forms/panels; manual screen-reader and real-device results are a separate evidence column.

## 7. Execution waves

Implementation slices must not all launch at once:

1. **Trust and reliability:** SEC-01, REL-01, E2E-01/02, UI-01/02/03. Independent source ownership can parallelize; one integration owner for global CSS/shared UI/i18n.
2. **Reader–creator loop:** COL-01 permissions/assignment → COL-02 private channel + creator workspace → REL-02 durable contribution. UI may proceed against the frozen contract while backend work is independent; no fake production API/placeholder counts. REL-03 is a separate reliability slice.
3. **Reference/style support:** COL-03 follows the private channel and source-identity contract.
4. **Assistance:** AI-01/02/03 follow COL-03; local and cloud qualification may run independently against the same acceptance corpus. Cloud dispatch stays disabled until both provider qualification and scoped consent are implemented. No whole-book background analysis.
5. **Cross-viewport and end-to-end proof:** apply the matrix to each delivered journey, then run integrated collaboration/privacy/offline scenarios. UX-01/02 proceed independently with shared-header/i18n ownership coordinated.

Future implementation swarm: backend owns schema/worker/authorization; reader owns composer/anchors; creator owns workspace/review; assistance owns provider adapters/reference analysis. Main owns route/capability/i18n integration. Freeze DTOs and permission tests before parallel consumers; agents skip concurrent builds/linters/tests until integration.

## 8. Stale roadmap reconciliation

- **GOAP-254** (`plans/254-goap-uiux-modernization-master-plan.md`): status `IN PROGRESS — implementation present; remaining verification and follow-ups tracked by GOAP-999`. Expired provider/quota and sequential-execution notes replaced with the current dependency model (independent read-only audit slices converge into this backlog; future implementation follows GOAP-999 waves). Dated 2026-08-23 history preserved as historical. W2 amended: the WCAG 2.2 target is already in DESIGN.md with prior evidence at `analysis/goap-254-audit-evidence.md`; remaining work is current gaps and broader coverage, not re-elevating the target. W4 amended: global sync status and capability-driven install UI are present in source; runtime/real-device gaps remain.
- **GOAP-255** (`plans/255-goap-epub-sparkle-uiux-port.md`): status `IN PROGRESS — W1 present in source; remaining UX and verification tracked by GOAP-999`. Old provider/branch/reference-check notes labeled historical. W2's obsolete `auth-resolution splash` and orphaned-nav claims replaced: current root is an immediate role-aware redirect; core navigation is wired via AppShell per GOAP-268. Public landing at `/` retained as a product/route decision, not an executable defect; separated from reader/admin surface verification. Current reconciliation subsection links GOAP-999 with source-evidenced implemented items.

## 9. Verification

### 9.1 Planning documentation verification (executable now)

```bash
node scripts/check-adr-index.mjs
```

Expected: exit code 0, `✓ ADR index validation passed (ADR-083)`.

- `plans/999-goap-codebase-improvements-uiux-e2e-audit.md` and `plans/999-adr-reader-creator-editorial-contract.md` exist with no placeholder headings, unassigned tasks or unresolved decisions.
- `plans/ADR-INDEX.md` contains the ADR-999 row under Proposed and the GOAP-999 row under Cross-referenced, with accurate paths and descriptions.
- `plans/254-goap-uiux-modernization-master-plan.md` and `plans/255-goap-epub-sparkle-uiux-port.md` link to GOAP-999 without claiming incomplete work as done.
- `plans/267-goap-preexisting-sweep.md` and unrelated files untouched.

No application test passes, server readiness, browser execution, accessibility certificates or performance improvements are claimed for this documentation change.

### 9.2 Future implementation acceptance checks

1. **Ordinary reader boundary (COL-01 / SEC-01):** reader with `commentsAllowed: false` opens a book — reading, TOC, search, font/theme controls, bookmarks work; selection exposes no comment/suggestion actions; `POST /api/books/:id/comments` returns 403; no unread feedback banner.
2. **Authorized feedback journey (COL-02 / COL-03):** reader with `commentsAllowed: true` selects a sentence on a mobile viewport — toolbar appears above selection; comment/suggest modal shows quoted excerpt + nearby context; grammar suggestion POST includes multi-signal locator, source file identity, exact text, replacement, category, `private` visibility; optimistic placeholder with pending badge; another reader with a grant for the same book cannot view it via list or direct ID; EPUB bytes identical.
3. **Creator review journey (COL-01 / COL-02):** creator for book A opens `/creator` — book A listed, book B absent; `/creator/books/:bookId/feedback` shows the suggestion with passage, chapter, replacement, explanation; reply + `accepted`; submitting reader sees disposition + reply; no broadcast; EPUB bytes unchanged; unassigned account fetching the endpoint gets 403.
4. **Offline contribution and recovery (REL-01 / REL-02):** offline, authorized reader creates a private suggestion + bookmark — both appear locally; reload shows cached content; no unhandled rejection or loss. Background Sync without page authentication — encrypted queue intact on disk, no corrupt null-payload entry. Reconnect authenticated — queue flushes once; one server suggestion with stable mutation identity; creator receives it.
5. **Grounded editorial assistance (AI-01 / AI-02 / AI-03):** without consent, controls show opt-in required and no background process runs. With consent, the corpus behaves per AI-03 items 1–8; `No supported findings` vs engine-failure states distinguished; cloud requires explicit provider confirmation and sends only selected passage context.
6. **Responsive and accessibility (UI-01 / UI-02 / UI-03 / UX-01 / UX-02):** full viewport matrix; 320 CSS px / 400% zoom without document/main horizontal scroll; sepia card contrast ≥4.5:1 body, ≥3:1 large; drawer keyboard/RTL behavior; audit refresh preserves filters; help controls in flow.
7. **E2E suite separation (E2E-01 / E2E-02):** local smoke passes without credentials; live Cloudflare login runs only in its dedicated lane with prerequisites; `pwa-chromium` verifies SW control and fails on unexpected skips; no empty tests remain in `reader-progress.spec.ts`.

## 10. Official sources

Retrieved 2026-09-10 via Tavily search and direct official-page reads. Retrieval date is not a publication/version claim; older canonical documentation can remain current guidance.

- W3C reflow: https://www.w3.org/WAI/WCAG22/Understanding/reflow.html — 320 CSS-pixel vertical content, limited two-dimensional-layout exceptions; table exceptions do not cover adjacent forms/pagination.
- W3C focus: https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html — AA requires focused controls not entirely hidden; fully unobscured is stronger.
- W3C targets: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html — 24px AA minimum with exceptions, separate from project 44px.
- Playwright best practices: https://playwright.dev/docs/best-practices — user-visible behavior, isolation, user-facing locators, retrying assertions.
- Playwright emulation: https://playwright.dev/docs/emulation — viewport resizing differs from touch/mobile/device emulation.
- Playwright service workers: https://playwright.dev/docs/service-workers — isolated SW-blocked tests differ from actual SW-enabled behavior; wait for activation/control, not just registration. Chromium limitation describes Playwright SW tooling, not universal browser support.
- Playwright accessibility: https://playwright.dev/docs/accessibility-testing — scan revealed states after interaction; axe alone does not certify WCAG compliance.
- Tailwind source detection: https://tailwindcss.com/docs/detecting-classes-in-source-files — explicit sources for monorepo/shared UI; stylesheet-relative paths, complete static class strings.
- Tailwind responsive design: https://tailwindcss.com/docs/responsive-design — mobile-first viewport and ancestor container queries.
- web.dev install: https://web.dev/articles/customize-install — capability-driven, user-triggered installation; no unsupported fake install button.
