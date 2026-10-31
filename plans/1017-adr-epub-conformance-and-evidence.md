# ADR-1017: Isolated EPUB Conformance, Interchange, and Accessibility Evidence

**Date:** 2026-10-31
**Status:** Accepted for implementation under GOAP-1017
**Deciders:** Project maintainer
**Issues:** #1414–#1419
**Related:** ADR-006, ADR-083, ADR-187, ADR-246, ADR-1012, ADR-1013, ADR-1015, GOAP-1017

## Context

The Worker currently performs a bounded JavaScript ZIP/package check on smaller uploads, while larger uploads skip that check. This is neither EPUBCheck nor a complete archive-safety boundary. A synchronous validator in the upload request would add unbounded latency and Java is unavailable in Cloudflare Workers. The reader has partial accessibility metadata parsing and generated EPUB fixtures, but no revision-bound conformance/accessibility evidence, capability-to-fixture contract, public annotation interchange profile, or WCAG 2.2 impact assessment.

The issues also expose four trust boundaries: uploaded EPUB archives, a validator process, imported annotation JSON, and untrusted publication content rendered in a sandboxed frame. Conformance, archive safety, reader-UI accessibility, and manual content accessibility are separate evidence types and must not be conflated.

## Decision

1. **EPUBCheck runs in an isolated Node service with Java**, pinned to the production release EPUBCheck 5.4.0. The service accepts bounded EPUB bytes through an authenticated private channel; it invokes the fixed CLI with argument-safe process spawning, bounded time/memory, isolated temporary storage, and structured JSON output. Validator code and tests are provider-neutral so a local CLI and remote service implement the same typed contract. The Cloudflare Worker never executes Java or waits for validation in the upload response.
2. **Worker orchestration is durable and revision-bound.** Persist the upload/revision first, then enqueue a compact immutable file/revision reference to a Cloudflare Queue; the queue consumer streams the R2 object to the runner and writes the result. Queue retries are bounded and exhausted work is visible through a dead-letter path; admin retry re-enqueues. Persist status, validator version, EPUB version, server-computed SHA-256, normalized severity/code/location/path, safe message, and bounded report JSON. A matching `(revision, sha256, validatorVersion)` is idempotent; changed bytes or validator version require a new result. Admin status/retry/report access requires the existing admin authorization boundary. Runner unavailability is visible as pending/failed and retryable; it is not reported as a pass. The Worker does not rely on `waitUntil()` for long-running validation.
3. **Archive safety is independent from conformance.** Reuse the existing streaming archive validator rather than making EPUBCheck the security boundary. Enforce path, entry-count, compressed/uncompressed size, ratio, and timeout limits before handing content to the Java validator. Hard safety rejection stays distinct from EPUBCheck errors/warnings; conformance findings alone do not discard an otherwise accepted revision.
4. **Accessibility evidence is a separate revision-scoped report.** Store metadata and provenance from the package document, machine-checkable structural advisories, and manual-review statuses distinctly. Record whether a finding concerns publication content or the reader UI. Reports explicitly state they are not certification. Recompute when revision bytes change; remediation state is bounded and never inferred from EPUBCheck severity alone.
5. **Capabilities are evidence-backed.** Every matrix entry states status, observed reader behavior, fixture, and engine/version. Generated fixtures are synthetic and deterministic. EPUB 3.3 is the Recommendation baseline; EPUB 3.4 is labeled draft/forward signal. Unsupported behavior produces a controlled, accessible explanation rather than a false capability claim.
6. **Annotation interchange is an independent, versioned adapter.** Keep the existing annotation model/API/storage semantics stable. Use a clearly labeled EPUB Annotations 1.0 Working Draft profile and Web Annotation selectors, preserve existing CFI/multi-signal location data, apply strict schemas and bounded namespaced extensions, treat imported body content as inert text, and never dereference payload URIs. Keep Markdown export/import compatibility.
7. **Accessibility claims remain evidence-scoped.** Update the target to WCAG 2.2 AA only after impact assessment. Automated axe findings cover app-owned UI, not EPUB content inside the sandbox. Manual procedures cover publication content, keyboard, zoom/reflow/fixed layout, language, and assistive technology. Record actual environment/results; never invent NVDA/VoiceOver evidence or equate an automated pass to conformance.

## Alternatives considered

- **Java inside the Worker:** impossible in the Workers runtime and would breach its execution/resource model.
- **Run EPUBCheck synchronously during upload:** unacceptable request latency and timeout risk, especially on large hostile archives.
- **Use EPUBCheck alone for safety:** rejected; its conformance diagnostics do not replace bounded archive parsing and path/size controls.
- **Run validation only in CI:** useful for fixtures but cannot provide per-upload, revision-bound admin evidence.
- **One combined conformance/accessibility status:** rejected because machine conformance, metadata, manual content checks, and reader UI are different claims.
- **Replace internal annotations with the draft model:** rejected; a profile adapter avoids changing stable API/storage contracts and allows draft evolution.
- **Claim WCAG 2.2 AA from axe alone:** rejected; automated testing cannot establish content accessibility or full WCAG conformance.

## Consequences

- Adds a deployable Java-backed runner and explicit configuration/health failure states; deployment credentials and service availability remain operational prerequisites.
- Adds bounded revision-scoped report storage and admin-only report access without putting Java in the Worker or making upload completion wait for EPUBCheck.
- Separates content-safety rejection, EPUBCheck conformance, metadata findings, manual review, and app UI accessibility in APIs and UI.
- Requires synthetic fixtures, version-pinned CI evidence, and explicit review when validator or reading-engine versions change.
- Annotation profile changes can be isolated from current internal annotation APIs and the private Markdown format.

## Official standards and platform references

- [EPUBCheck command-line usage](https://github.com/w3c/epubcheck/wiki/Running)
- [EPUBCheck 5.4.0 release](https://github.com/w3c/epubcheck/releases/tag/v5.4.0)
- [EPUB 3.3 Recommendation](https://www.w3.org/TR/epub-33/)
- [EPUB Reading Systems 3.3 Recommendation](https://www.w3.org/TR/epub-rs-33/)
- [EPUB 3.4 Candidate Recommendation Draft](https://www.w3.org/TR/epub-34/)
- [EPUB Accessibility 1.1 Recommendation](https://www.w3.org/TR/epub-a11y-11/)
- [EPUB Annotations 1.0 Working Draft](https://www.w3.org/TR/epub-anno-10/)
- [Web Annotation Data Model](https://www.w3.org/TR/annotation-model/)
- [WCAG 2.2 Recommendation](https://www.w3.org/TR/WCAG22/)
- [Cloudflare Workers `waitUntil()` lifetime and Queue guidance](https://developers.cloudflare.com/workers/runtime-apis/context/#waituntil)
- [Cloudflare Queues configuration, producers, consumers, and retries](https://developers.cloudflare.com/queues/configuration/configure-queues/)

## Verification

Implementation and acceptance evidence are tracked in [GOAP-1017](1017-goap-open-github-issues-1414-1419.md). Verification remains pending until the full feature, service/browser smoke, repository quality gates, Codacy, and PR CI have all been observed.
