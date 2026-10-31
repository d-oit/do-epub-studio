# GOAP-1017: Close Open EPUB Conformance, Interchange, and Accessibility Issues

**Status:** IN PROGRESS
**Date:** 2026-10-31
**Issues:** #1414, #1415, #1416, #1417, #1418, #1419
**Decision:** [ADR-1017](1017-adr-epub-conformance-and-evidence.md)
**Design:** [System design](003-system-design.md#goap-1017--epub-conformance-annotation-interchange-and-accessibility-evidence)
**TRIZ analysis:** [analysis/triz-core-2026-10-31.md](../analysis/triz-core-2026-10-31.md)

## Goal

Close every acceptance criterion in the six open issues with a reviewable pull request. Preserve the Worker trust boundary, reader compatibility, and existing annotation API/storage contracts. No EPUB bytes or quoted content are added to the synthetic fixture corpus.

## Baseline

- `main` was fetched and was already current before work began; implementation is on `codex/issues-1414-1419-epub-conformance`.
- GitHub issue inventory returned exactly six open issues: #1414–#1419; open PR inventory was empty.
- Upload validation currently uses a JS ZIP/package check only for uploads below 25 MiB; it is not EPUBCheck. `book_files` stores the old result JSON and has no persistent EPUBCheck/accessibility report contract.
- Reader-core already has a streaming archive-safety validator. Reader-core parses some EPUB Accessibility metadata, but does not provide revision-scoped validation evidence.
- Note export/import is a private Markdown/JSON mechanism; import is not exposed in the reader UI. The current accessibility guide targets WCAG 2.1 AA; Playwright axe scans a subset of app routes, and the content iframe is an explicit trust boundary.
- `packages/reader-core/src/__tests__/fixtures/generate.mjs` creates synthetic EPUBs; there is no pinned EPUBCheck report artifact or complete feature-evidence matrix.

## Acceptance and evidence

| Issue | Required outcome                                                                                                                                                                                                                                                                                                                    | Evidence to record before closure                                                                                                                                                                                                                |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| #1414 | EPUBCheck 5.4.0 runs outside request latency; typed provider-neutral results; bounded revision report; resumable/idempotent by revision hash and validator version; admin summary/grouped findings/JSON download; safety failures distinct from conformance diagnostics; hostile inputs and auth handled.                           | Runner/Worker contract tests, EPUB 2/3 valid and invalid fixtures, archive safety tests, idempotence and authorization scenarios, admin browser smoke, CI tool-version evidence. No Java invocation in Worker code.                              |
| #1415 | Matrix covers requested EPUB generations, layouts, renditions, navigation, scripting policy, MathML/SVG, media overlays, remote resources, RTL/vertical, dictionaries/glossaries, and accessibility metadata; every status has a fixture; 3.4 draft status is explicit.                                                             | Synthetic fixture provenance and matrix tests; Chromium and WebKit baseline smoke; unsupported behavior explains the limitation accessibly; matrix identifies engine/version.                                                                    |
| #1416 | Separately versioned EPUB Annotations 1.0 Working Draft profile; maps identity, selectors, annotation body/motivation, permitted creator/timestamps; preserves multi-signal locators and bounded namespaced extensions; strict import; no remote dereference/HTML execution; existing Markdown remains compatible; UI labels draft. | Round-trip tests for highlights/bookmarks/comments, malformed/unsupported/duplicate/invalid input tests, size/URI policy tests, reader UI import/export smoke.                                                                                   |
| #1417 | Revision-scoped EPUB Accessibility 1.1 metadata and EPUBCheck evidence with provenance; machine/manual/UI scopes distinguished; structural advisories and remediation states; reruns per revision; no certification claim.                                                                                                          | Metadata and report tests for OPF provenance, warnings/advisories/manual status, stale revision handling; admin report smoke.                                                                                                                    |
| #1418 | WCAG 2.2 AA target is impact-assessed, not claimed as achieved; criteria/evidence include new SCs; axe covers app-owned reader/creator/admin routes, frame names and focus restoration; manual publication procedure and reusable record; trust boundary explicit; real keyboard and NVDA/VoiceOver journeys recorded.              | Route/axe tests and manual keyboard session evidence. NVDA/VoiceOver is recorded only if available in the test environment; no fabricated AT evidence. Any unavailable external AT session remains an explicit blocker, not a conformance claim. |
| #1419 | Small synthetic fixture suite covers all listed content types; pinned EPUBCheck CI; deterministic errors separate from advisories/manual review; corpus provenance and release-candidate artifact.                                                                                                                                  | Fixture generator checks, EPUBCheck CI output artifact, cross-browser smoke, documented manual NVDA/VoiceOver/frame-boundary checklist and result classification.                                                                                |

## Execution slices

1. **Plan and architecture** — ADR-1017, system design, this plan, and TRIZ contradiction resolution. Preserve unresolved operational prerequisites explicitly.
2. **Validator and revision reports (#1414, #1417)** — extract/reuse the streaming safety boundary; implement isolated Node/Java runner pinned to EPUBCheck 5.4.0; typed, bounded report storage and admin-only status/retry/download; revision hash/version idempotence; separate accessibility metadata/advisory evidence.
3. **Capability corpus (#1415, #1419)** — deterministic synthetic feature fixtures, capability matrix linked to fixture identifiers and behavior, pinned CI validation, release artifact; include Chromium/WebKit visual smoke where the existing harness supports it.
4. **Annotation interchange (#1416)** — add an independent draft-profile adapter and strict trust-boundary schemas; wire user-visible JSON import/export without replacing Markdown; retain unsupported namespaced extensions under a strict size budget without changing existing internal API DTOs.
5. **WCAG impact and procedure (#1418)** — update WCAG version/criteria/evidence; expand axe route coverage and frame/focus assertions; add manual publication and assistive-technology record templates; execute real keyboard testing.
6. **Integration and verification** — reconcile migrations/contracts; run the specific regression scenarios, `./scripts/quality_gate.sh`, `./scripts/validate-workflows.sh`, and Codacy; fix surfaced failures without weakening gates; run actual browser/service smoke paths; update project learning; open/update a feature-branch PR and verify all required CI statuses.

## Non-negotiable boundaries

- The Cloudflare Worker never starts Java or blocks upload completion on EPUBCheck. A durable Cloudflare Queue carries only persisted revision/file identifiers; a queue consumer streams the R2 object to the isolated runner, retries transient failures, and routes exhausted retries for admin-visible recovery.
- EPUBCheck conformance findings are not silently treated as safety failures; independent archive/request safety limits remain enforced.
- Service results contain sanitized, bounded diagnostics only: no EPUB source snippets, no attacker-controlled URLs dereferenced, no public runner endpoint.
- Machine-detectable accessibility metadata/advisories are not a certification or a substitute for manual review or reader-UI testing.
- Synthetic fixtures contain original generated content only. EPUB 3.4 is marked as a draft/forward-looking signal, not a Recommendation.
- WCAG 2.2 AA is an impact-assessed target, never a claim of conformance based solely on automated tests.
- CI evidence, including Codacy, must be observed green on the PR before declaring closure. Do not merge without an explicit request.

## Completion record

- **#1414 & #1417 (EPUBCheck runner & accessibility evidence)**: Implemented `apps/epubcheck-runner` (Node 22, pinned EPUBCheck 5.4.0, structured JSON), durable Cloudflare Queue `EPUB_VALIDATION_QUEUE` consumer in `apps/worker/src/lib/epub-validation-queue.ts`, migrations `0024-epub-conformance-reports.sql` and `0025-annotation-interchange.sql`, admin routes for listing, detailed grouped report, report JSON download, retry, and accessibility remediation state. Verified by unit tests in `apps/worker/src/__tests__/routes.admin.books-validation.test.ts` and `apps/epubcheck-runner/test/server.test.ts`.
- **#1415 & #1419 (Capability matrix, synthetic corpus, CI gate)**: Full matrix documented in `docs/epub-capability-matrix.md` with explicit Recommendation baseline and draft 3.4 designations; 22 synthetic fixtures generated in `packages/reader-core/src/__tests__/fixtures/generate-capabilities.mjs` and tested in `packages/reader-core/src/__tests__/capability-corpus.test.ts`; cross-browser rendering smoke in `apps/tests/epub-capability-smoke.spec.ts` passes on both Chromium and WebKit; pinned EPUBCheck fixture validation in `scripts/check-epub-fixtures.mjs` and `.github/workflows/ci.yml`.
- **#1416 (Annotation interchange)**: EPUB Annotations 1.0 Working Draft profile in `packages/schema/src/schemas/annotation-interchange.ts`, reader UI import/export bar in `AnnotationInterchangeBar.tsx`, authorized persistence route `interchangeRouter` in `apps/worker/src/routes/reader/interchange.ts`, 14 locale translations, tested in `annotation-interchange.test.ts` across web, schema, and worker.
- **#1418 (WCAG 2.2 AA target and manual testing)**: Updated `docs/accessibility.md` with assessed WCAG 2.2 AA target, criterion breakdown, and machine-vs-human evidence limits; reusable record template in `docs/accessibility-manual-test-record.md`; expanded Playwright axe-core audit covering creator workspace, reader dialog keyboard navigation and focus restoration in `apps/tests/accessibility-audit.spec.ts` (10/10 passed).
- **Monorepo quality gates**: `./scripts/quality_gate.sh` passed clean (`✓ All Quality Gates PASSED`), `scripts/validate-workflows.sh` passed (17/17 workflows), `pnpm typecheck` passed, `pnpm lint` passed with 0 warnings, `pnpm test:unit` passed across all packages, `pnpm test:coverage` met all coverage thresholds, and `pnpm bundle:budget:enforce` verified all bundles within budget.

- **Codacy SSRF triage**: Result `131558147834` is a false positive. `EPUBCHECK_RUNNER_URL` is a deployment-owned Worker setting; incoming requests and queue messages cannot set it (queue messages contain only persisted book/revision IDs). The Worker also pins requests to the configured origin's `/validate` path and accepts only HTTP(S). The source comment records this trust boundary; Codacy Cloud ignore reason is `FalsePositive`. The issue must remain rechecked on the updated PR head.
