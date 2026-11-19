# TRIZ Resolution — EPUB Annotation Re-export

**Date:** 2026-11-09
**Analysis:** `analysis/triz-core-2026-11-09.md`
**Issue:** #1432

## Resolved: Contradiction 1 — source fidelity versus bounded package rewriting

**Problem:** Adding annotations to an EPUB must preserve its existing content and metadata, while Worker ZIP rewriting and full-file validation consume memory.

**IFR:** The exported EPUB retains every source publication resource and package metadata, adds only an annotation appendix/package reference, and never exceeds explicit source, uncompressed, annotation, or output limits.

**Separation:** Condition separation; bounded exports are processed in the Worker, while inputs exceeding any limit are rejected before the operation that would increase memory pressure.

**Solution:** Keep original spine content/resources unchanged. Add one dedicated XHTML annotation appendix and only the necessary package manifest/spine/navigation entries. Apply independent hard caps before unzipping, before annotation rendering, and after ZIP generation. Run archive-safety validation on both source and result.

**Why Better:** The generated publication stays additive and readable, while archive processing has a calculable upper bound. Oversize input gets an explicit limit error rather than an unbounded buffer or partial file.

**New Contradictions:** NONE. A strict export cap reduces availability for large books; it is an intentional and explicit boundary required by Worker memory limits.

## Resolved: Contradiction 2 — direct navigation versus untrusted/stale locators

**Problem:** Annotation locators need source navigation, but stored chapter references and CFIs can be stale, malformed, or contain attacker-controlled text.

**IFR:** Every annotation remains in the export; links are emitted only when its locator resolves inside the selected revision, and all other data remains readable with an explicit unresolved marker.

**Separation:** Condition separation and segmentation; trusted EPUB manifest/spine paths control links, and annotation prose is rendered as escaped text in the separate appendix.

**Solution:** Resolve chapter references only by exact membership in the selected EPUB's spine/manifest. Validate CFI syntax and keep generated links relative to package resources; never use annotation URIs as fetch targets. Treat orphaned/needs-review revisions, invalid bookmark JSON, absent chapters, malformed CFIs, or ambiguous locators as unresolved and include their available chapter/quote/context in an explicitly labeled appendix entry. Escape all user-controlled XHTML text.

**Why Better:** Valid links navigate within the packaged publication. Stale annotations are retained without unsafe path construction or silent reinterpretation.

**New Contradictions:** NONE. Some annotations will be marked unresolved when evidence is insufficient; preserving that uncertainty is safer than guessing a target.

## Resolved: Contradiction 3 — EPUBCheck before response versus latency/availability

**Problem:** The endpoint must not return an unvalidated EPUB, while EPUBCheck runs in a separate authenticated Java runner and can take time or be unavailable.

**IFR:** A successful export means the exact returned bytes passed archive-safety, EPUB structure, and EPUBCheck; runner failure is actionable and never treated as success.

**Separation:** System-level separation and time separation; the existing isolated runner performs full EPUBCheck after Worker-local checks, synchronously within the export request only for the bounded generated artifact. Existing asynchronous upload validation remains unchanged.

**Solution:** Reuse the existing fixed `/validate` runner URL construction and bearer-token boundary. Bound the request/response and rely on the runner's runtime cap. Reject generated archives with safety failures or EPUBCheck error findings; return distinct client-visible validation/runner errors. Do not queue or persist the export.

**Why Better:** The returned artifact is validated before delivery, without launching Java inside the Worker or changing the upload revision queue.

**New Contradictions:** NONE. The export is unavailable when the configured validator is unavailable; this is the required fail-closed result, not a false success.

## Resolved: Contradiction 4 — local Markdown export versus server-authorized EPUB export

**Problem:** EPUB export needs server-side original bytes and access control, but the existing Markdown download works offline from the local reader store.

**IFR:** Users retain offline Markdown export while online EPUB export uses the current authenticated session, authorized book revision, and server-owned annotations.

**Separation:** System/condition separation; preserve the local Markdown code path, and use the authenticated export API only for server-generated formats.

**Solution:** Keep the current local Markdown renderer/download unchanged. Add a reader format selector; existing HTML and new EPUB API paths use the shared export query contract and raw-response download handling. Keep annotation-interchange JSON outside this selector.

**Why Better:** The new online capability does not regress local/offline notes export or conflate the separate JSON interchange feature.

**New Contradictions:** NONE. HTML/EPUB require the existing online access session, matching the server route's authorization boundary.

## System design derivation

| Component                  | Contract                                                                                                                                                                                                                                                                                                                                                              |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared schema              | Add `epub` to the export format query; preserve existing Markdown default and HTML response shape. The EPUB response is a bounded binary attachment with `application/epub+zip` and a sanitized filename.                                                                                                                                                             |
| Reader-core package helper | Read a validated bounded EPUB, preserve source resources/metadata, append escaped annotation XHTML, add package/navigation references, resolve only manifest/spine-backed links, and return bounded ZIP bytes. No network access.                                                                                                                                     |
| Worker export route        | Reuse `readerAuth`, `assertBookAccess`, and per-user annotation queries. Select the same newest revision as the reader; reject missing/local/mismatched/oversize R2 files. Enforce annotation caps before rendering. Validate exact output with archive safety, EPUB structural validation, and the configured EPUBCheck runner before response.                      |
| Reader UI                  | Add localized format selection. Keep the current local Markdown path. Download existing HTML JSON output and new EPUB binary using the authenticated raw API helper.                                                                                                                                                                                                  |
| Verification               | Deterministic package tests cover content/metadata preservation, link resolution, unresolved entries, escaping, malformed archives/locators, and all size limits. Worker tests cover authorization, R2/runner failures, all formats, and validation errors. Reader-core integration loads the result with the production reader; EPUBCheck validates generated bytes. |

**Final status:** All four contradictions resolved; no secondary contradiction left open. The implementation must not start until these decisions are applied.
