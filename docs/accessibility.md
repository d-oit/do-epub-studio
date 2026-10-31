# Accessibility guide

## Scope and target

WCAG 2.2 Level AA is the product's assessed accessibility target. It is a target
for ongoing design and testing, **not a claim that this application, any route,
or any EPUB conforms to WCAG or is certified accessible**. Conformance requires
assessment of complete pages and processes, including human evaluation of
publication content and relevant combinations of technology. Record observations
with the reusable [manual accessibility test record](accessibility-manual-test-record.md).

App UI and publication content are separate test surfaces. The reader hosts EPUB
content in a scripts-disabled sandboxed frame. App scans must not traverse or
inspect publisher HTML as if it were app-owned DOM. The frame element itself is
app-owned: check its accessible name and the user's ability to navigate into and
out of it. Publication-level checks require inspecting the synthetic/approved
publication as publication content, never treating publisher markup as trusted
application interface.

## WCAG 2.2 criteria added to the assessment

These criteria were added in WCAG 2.2. The level shown is the normative WCAG
level; applicability is assessed per route, process, and publication.

| Criterion                                     | Level | Assessment evidence and scope                                                                                                                                                                                                                                                                                                                               |
| --------------------------------------------- | ----: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **2.4.11 Focus Not Obscured (Minimum)**       |    AA | Manually inspect focused controls in app chrome and reader controls at representative viewport sizes, including open panels, dialogs, sticky areas, and overlays. Verify the focused item is at least partially visible and not wholly hidden by author-created content. Axe does not establish this criterion.                                             |
| **2.5.7 Dragging Movements**                  |    AA | For every feature requiring dragging, manually verify a single-pointer alternative that does not require a dragging movement. Keyboard operation alone does not satisfy the criterion's single-pointer alternative requirement. Record applicable drag interactions and alternatives; axe cannot establish equivalence.                                     |
| **2.5.8 Target Size (Minimum)**               |    AA | Assess pointer targets against the 24-by-24 CSS pixel minimum or applicable spacing/equivalent exceptions. Include the criterion's exceptions when documenting a result. Automated target-size rule results are screening evidence, not a complete contextual determination.                                                                                |
| **3.3.7 Redundant Entry**                     |     A | Inspect multi-step processes and verify information previously entered or provided by the user is auto-populated or selectable, unless re-entry is essential, required for security, or the prior information is no longer valid. Record the process and the applicable exception, if any.                                                                  |
| **3.3.8 Accessible Authentication (Minimum)** |    AA | For authentication steps, verify that a cognitive function test is not required unless an allowed exception applies, such as an alternative authentication method, a mechanism assisting completion, or object recognition. Password-manager and paste support are relevant; record the actual path. Do not infer compliance from a successful login alone. |

**3.2.6 Consistent Help is Level A**, not AA. Assess it where help mechanisms are
provided on multiple pages: their relative order should remain consistent unless
the user initiates a change. Record whether help is present and the pages
compared. **2.4.13 Focus Appearance is Level AAA**, not AA; it may be considered
as a higher-level design goal but must not be reported as an AA criterion.

## Automated app-interface coverage

`apps/tests/accessibility-audit.spec.ts` uses axe-core with WCAG A/AA tags,
including the WCAG 2.2 AA tag, on representative login, reader, creator, and
admin routes and reader panels. These scans test rendered app-owned UI only.
The EPUB frame host is excluded to prevent traversal into sandboxed publisher
content; its `<iframe>` element remains checked separately for a non-empty
accessible name. Axe results do not establish WCAG conformance and cannot decide
content quality, meaningful image alternatives, reading order, keyboard
usability, target-size exceptions, or the other contextual/manual criteria.

The browser tests also exercise keyboard opening/dismissal of reader settings
and contents, movement of focus while open, and focus restoration to each
trigger. This is a regression check for those transitions, not a substitute for
manual keyboard testing across the full interface.

## Manual publication and reader procedure

Use synthetic or approved test publications; never paste private EPUB text or
personal data into test reports, logs, or fixtures. Record exact browser,
assistive technology, route, content identifier, and actions in the reusable
record. Mark untested items as **Not tested** rather than implying coverage.

1. **Keyboard and reader frame:** Start outside the reader frame and navigate
   using Tab, Shift+Tab, Enter, Space, arrow keys where the control pattern
   calls for them, and Escape where dismissal is supported. Confirm visible,
   logical focus, no keyboard trap, reachable reader controls, and a way to
   enter and leave the named publication frame. Open and close each panel/dialog
   and check focus placement and restoration. Do not rely on a pointer.
2. **Reading order and structure:** With a screen reader, browse by headings,
   landmarks, paragraphs, lists, and other structure. Compare the announced
   sequence with the intended publication order, including notes, sidebars,
   page breaks, and reading-system controls. Identify structural issues in the
   EPUB separately from app chrome.
3. **Image alternatives:** Inspect informative, decorative, and complex images.
   Verify alternatives convey the relevant purpose/information, decorative
   images do not add noise, and complex visual information has an equivalent
   explanation. A non-empty `alt` attribute alone is not evidence of a useful
   alternative.
4. **Tables:** Navigate each data table with the screen reader and determine
   whether row/column headers and relationships are announced with cells.
   Check captions and table purpose; identify layout tables that are exposed
   misleadingly as data tables. Include small and multi-level header examples
   when present.
5. **Zoom, reflow, and fixed layout:** Increase text/browser zoom (including
   200%) and inspect a narrow viewport in reflowable content for clipping,
   lost controls, and unnecessary two-dimensional scrolling. For fixed-layout
   publications, inspect enlarged regions and all content, record required
   horizontal/vertical panning, and note any content that cannot be reached or
   read; do not label fixed layout as reflowable.
6. **Language:** Check the declared publication language and sample passages
   whose language changes. Listen to determine whether the screen reader uses
   the expected pronunciation/language behavior. Check app interface locale
   separately from publication language.
7. **Evidence and defects:** Note action/result pairs, not just “works.” Classify
   each issue as app UI, publication content, or their interaction. Keep
   evidence redacted or synthetic and link defect identifiers without embedding
   publication text.

### Machine and human evidence boundaries

Automated axe scans can flag a subset of detectable markup and accessibility
rule failures on the scanned app-owned DOM. They cannot assess a publication's
meaning, whether alternate text is useful, actual reading order, usability with
assistive technology, all keyboard paths, cognitive demands, or contextual
exceptions. A zero-violation scan is not proof of WCAG conformance.

Manual keyboard and assistive-technology observations are evidence only for the
recorded environment, route, content, and actions. A browser test that sends
keyboard events is not a screen-reader test. No NVDA, VoiceOver, or other
screen-reader result should be reported unless that journey was actually
performed and documented.

## Related references

- [WCAG 2.2 Recommendation](https://www.w3.org/TR/WCAG22/)
- [WCAG 2.2 Understanding documents](https://www.w3.org/WAI/WCAG22/Understanding/)
- [WAI-ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [axe-core rule descriptions](https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md)
