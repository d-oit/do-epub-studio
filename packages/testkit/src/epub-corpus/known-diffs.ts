/**
 * Triage of expected disagreements between this corpus's expectations and
 * EPUBCheck (v5.4.x) findings.
 *
 * The differential job (scripts/diff-corpus-epubcheck.mjs) compares EPUBCheck
 * output against each fixture's manifest expectations. A finding that has a
 * triage entry here is *acknowledged* and therefore does not fail the job —
 * but it is never silently swallowed: it is reported with its rationale. Any
 * unexpected disagreement fails the job.
 *
 * Note: entries are triaged against documented EPUBCheck 5.4 behavior and
 * marked `verified: false` until the first live run reconciles them (the
 * runner requires a local `epubcheck.jar` or an EPUBCHECK_RUNNER_URL, so this
 * repo never vendors it).
 */

export interface KnownDiff {
  fixtureId: string;
  /** EPUBCheck finding code/family we expect to disagree on. */
  epubcheckCode: string;
  scope: 'fixture' | 'fixture-hidden';
  /** What the corpus expects (our behavior). */
  expectation: string;
  /** What EPUBCheck reports and why that is not a product defect. */
  rationale: string;
  verified: boolean;
}

export const KNOWN_DIFFS: readonly KnownDiff[] = [
  {
    fixtureId: 'missing-mimetype',
    epubcheckCode: 'RSC-004',
    scope: 'fixture',
    expectation:
      'The archive parses and loads; the corpus reports MIMETYPE_ABSENT as a spec deviation.',
    rationale:
      'EPUBCheck rejects/marks the package for the missing mimetype entry. Our reader does not gate loading on mimetype (the container is still navigable), which is a deliberate tolerance — the deviation is surfaced by the corpus diagnostic instead of failing the load.',
    verified: false,
  },
  {
    fixtureId: 'mimetype-not-first',
    epubcheckCode: 'RSC-004',
    scope: 'fixture',
    expectation: 'The book loads; MIMETYPE_NOT_FIRST is reported at archive level.',
    rationale:
      'EPUBCheck enforces the EPUB 3 mimetype-first requirement. Most readers (ours included) are tolerant of ordering; the corpus keeps the fixture because it is a real-world malformed case we must not regress on.',
    verified: false,
  },
  {
    fixtureId: 'xxe-external-entity',
    epubcheckCode: 'RSC-005',
    scope: 'fixture',
    expectation:
      'The entity is never expanded and no host file content can appear; the book renders the remaining text.',
    rationale:
      'EPUBCheck may flag the custom DTD/entity as an error, while our reader treats the entity as unresolvable and renders the document safely. The security property we assert is confinement, not conformance.',
    verified: false,
  },
  {
    fixtureId: 'script-event-handlers',
    epubcheckCode: 'SCRIPT-001',
    scope: 'fixture',
    expectation: 'Script elements and event-handler attributes are stripped before render.',
    rationale:
      'EPUBCheck flags scripted content (SCRIPT-001) as a warning because scripts are permitted by the EPUB spec; our product strips them for safety. This is a policy difference, not a defect.',
    verified: false,
  },
  {
    fixtureId: 'svg-script',
    epubcheckCode: 'SCRIPT-001',
    scope: 'fixture',
    expectation: 'SVG script/event/foreignObject payloads are stripped before render.',
    rationale:
      'Same policy difference as script-event-handlers, applied within SVG content.',
    verified: false,
  },
  {
    fixtureId: 'unsafe-schemes',
    epubcheckCode: 'HTM-007',
    scope: 'fixture',
    expectation: 'href/src values with unsafe schemes are removed.',
    rationale:
      'EPUBCheck 5.4 does not reject javascript:/data:/file: URI schemes in content (it may warn on some link targets). We remove them, so our rendered output is stricter than EPUBCheck conformance.',
    verified: false,
  },
  {
    fixtureId: 'url-edge-cases',
    epubcheckCode: 'HTM-007',
    scope: 'fixture',
    expectation:
      'Executable schemes are stripped; obfuscated and scheme-relative forms stay inert and are enforced at network egress.',
    rationale:
      'EPUBCheck reports none of the obfuscated forms; we explicitly document their inertness. The block-all external-URL policy is the backstop for scheme-relative fetches, which EPUBCheck cannot observe.',
    verified: false,
  },
  {
    fixtureId: 'remote-resources',
    epubcheckCode: 'RSC-012',
    scope: 'fixture',
    expectation: 'Absolute remote resource references are stripped by the sanitizer; nothing is fetched.',
    rationale:
      'EPUBCheck expects remote references to resolve or else warning (RSC-012) — it does not treat them as unsafe. Our default policy blocks all external resource loads.',
    verified: false,
  },
  {
    fixtureId: 'encrypted-resources',
    epubcheckCode: 'RSC-013',
    scope: 'fixture',
    expectation:
      'AES-128-CBC declaration is tolerated; decryption is gracefully unsupported and the book still opens.',
    rationale:
      'EPUBCheck validates encryption.xml structure (RSC-013 family). We intentionally keep plaintext payloads; the fixture documents the declarative-only path and the graceful-unsupported behavior.',
    verified: false,
  },
  {
    fixtureId: 'zip-bomb-ratio',
    epubcheckCode: 'RSC-017',
    scope: 'fixture-hidden',
    expectation: 'Archive-level rejection via compression-ratio guard (before any EPUB parsing).',
    rationale:
      'EPUBCheck will refuse or hang on the inflated bomb; our validator rejects at the ratio gate first. The “disagreement” is ordering/mechanism, not outcome: both decline the input.',
    verified: false,
  },
  {
    fixtureId: 'malformed-zip-truncated',
    epubcheckCode: 'RSC-017',
    scope: 'fixture-hidden',
    expectation: 'Archive-level rejection as corrupt.',
    rationale:
      'EPUBCheck also rejects the package; we reject earlier in the pipeline. Same outcome, earlier gate.',
    verified: false,
  },
  {
    fixtureId: 'malformed-zip-declared-size',
    epubcheckCode: 'RSC-017',
    scope: 'fixture-hidden',
    expectation: 'Archive-level rejection as corrupt (declared size mismatch).',
    rationale:
      'EPUBCheck reports a ZIP structural error; we reject at validation. Same outcome, earlier gate.',
    verified: false,
  },
  {
    fixtureId: 'malformed-zip-traversal',
    epubcheckCode: 'RSC-017',
    scope: 'fixture-hidden',
    expectation: 'Archive-level rejection via path-traversal guard.',
    rationale:
      'EPUBCheck does not model path traversal in entry names (it may extract into a sandbox). Our validator rejects — a stricter-than-conformance security gate.',
    verified: false,
  },
  {
    fixtureId: 'oversized-resource',
    epubcheckCode: 'RSC-017',
    scope: 'fixture-hidden',
    expectation: 'Size-limit gate rejects oversized archives; the corpus exercises it with a reduced limit deterministically.',
    rationale:
      'EPUBCheck has its own size heuristics; our bounds differ. The fixture documents the limit path without shipping a >100 MiB artifact.',
    verified: false,
  },
];
