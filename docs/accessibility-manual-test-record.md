# Manual Accessibility Test Record

Copy this record for each publication/content and app accessibility review. Record only synthetic or approved test content; do not include private EPUB text, user data, credentials, or identifying screenshots.

## Session

- **Date/time and time zone:**
- **Tester / role:**
- **Environment / device and OS / display settings:**
- **Browser and version:**
- **Assistive technology and version (or “keyboard only”):**
- **App version / commit:**
- **Route(s):**
- **Content identifier and controlled test description (no private content):**
- **Rendition mode:** reflowable / fixed layout / not applicable
- **Viewport, zoom, text scaling, and orientation:**

## Procedure and observations

For each row, record concrete actions and expected/observed results. Use **Pass**, **Fail**, **Not tested**, or **Not applicable**. A pass applies only to the stated route, browser/AT, content, and actions.

| Area                                                           | Actions performed | Expected behavior                                                                                                                                                                                                | Result / evidence reference | Defect ID or notes |
| -------------------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ------------------ |
| Keyboard operation and focus                                   |                   | All app controls and publication interactions can be operated without a pointer; focus remains visible and order is meaningful; no keyboard trap.                                                                |                             |                    |
| Reader frame navigation                                        |                   | Frame has an informative name; keyboard/AT can enter and leave it and return to reader controls.                                                                                                                 |                             |                    |
| Reading order and structure                                    |                   | Headings, lists, landmarks, and sequence communicate the intended reading order.                                                                                                                                 |                             |                    |
| Image alternatives                                             |                   | Informative images have useful equivalent alternatives; decorative images are ignored; complex images have an equivalent description.                                                                            |                             |                    |
| Tables                                                         |                   | Header/data relationships and table navigation are understandable; layout tables are not presented as data tables.                                                                                               |                             |                    |
| Zoom and reflow                                                |                   | At 200% text zoom and a narrow viewport, content and controls remain available without loss; note any two-dimensional content.                                                                                   |                             |                    |
| Fixed layout                                                   |                   | At increased zoom, content can be inspected without clipping meaningful information; record unavoidable two-dimensional navigation.                                                                              |                             |                    |
| Language                                                       |                   | Publication language and changes of language are identified and conveyed by the chosen AT/browser.                                                                                                               |                             |                    |
| Reader panels/dialogs                                          |                   | Keyboard opening, navigation, dismissal, and focus restoration work for each panel/dialog tested.                                                                                                                |                             |                    |
| Errors / repeated entry / help / authentication (when present) |                   | Errors are identified; previously entered information is not needlessly requested again; help is consistently located; authentication does not rely on a cognitive function test without an allowed alternative. |                             |                    |

## Defects

For each failure, record a concise reproducible description, route/content identifier, exact actions, actual versus expected outcome, impact, and a safe evidence reference. Do not attach or quote private publication content. Note whether a defect is in app chrome, the sandboxed publication, or their interaction.

## Summary and limitations

- **Overall outcome for this session:**
- **Unresolved defects:**
- **Coverage not performed / reason:**
- **Evidence retained and storage location (redacted/synthetic only):**
- **Reviewer:**

This record is an evidence log, not a WCAG conformance statement or accessibility certification.

## Completed session record: keyboard-only reader smoke (2026-10-31)

### Session

- **Date/time and time zone:** 2026-10-31 14:32 UTC.
- **Tester / role:** OpenAI Codex coding assistant; keyboard-only browser exploratory session. Chromium received keyboard input events; this was not an assistive-technology session.
- **Environment / device and OS / display settings:** WSL2 workstation with the managed browser reporting Windows 10 x64; 1365 × 768 CSS-pixel viewport, device pixel ratio 1.25.
- **Browser and version:** Chrome 150.0.0.0 (user agent).
- **Assistive technology and version:** Keyboard only; no screen reader. PowerShell `Get-Command nvda.exe` returned “NVDA not found”; VoiceOver is unavailable on this Windows/WSL workstation.
- **App version / commit:** PR #1420 head `d889397` plus the local annotation-interchange layout and focus-indicator changes under test.
- **Route(s):** `/login?book=my-test-book` → `/read/my-test-book`.
- **Content identifier and controlled test description:** Synthetic `MOCK_EPUB` from `apps/tests/fixtures.ts`; one reflowable chapter titled “My Test Book” with generated text only. Local fixture API returned the login and EPUB responses; no production account or publication was used.
- **Rendition mode:** Reflowable; no fixed-layout metadata.
- **Viewport, zoom, text scaling, and orientation:** 1365 × 768 CSS pixels, default zoom and text scale, landscape.

### Procedure and observations

| Area                                            | Actions performed                                                                                                                                | Expected behavior                                               | Result / evidence reference                                                                                                                        | Defect ID or notes                                                   |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Keyboard operation and focus                    | Used Tab to reach the skip link, email, password, reader controls, and annotation import input; typed test credentials and submitted with Enter. | Visible focus and reachable controls; no pointer required.      | **Pass** for this path. The import input is visually clipped, but its visible label now shows a focus ring when the input receives keyboard focus. | Scoped to the recorded login and reader path.                        |
| Reader frame navigation                         | Tabbing reached the named EPUB iframe; Shift+Tab returned to the annotation import input.                                                        | Frame name is exposed; keyboard can enter and leave the frame.  | **Pass** for this path. Iframe title: “My Test Book”; sandbox: `allow-same-origin`; fixture text rendered inside it.                               | No publisher script was injected.                                    |
| Reading order and structure                     | Not performed with a screen reader.                                                                                                              | AT announces a meaningful publication reading order.            | **Not tested.**                                                                                                                                    | NVDA/VoiceOver was unavailable; keyboard testing is not AT evidence. |
| Image alternatives                              | Fixture contains no images.                                                                                                                      | Informative images have useful alternatives.                    | **Not applicable.**                                                                                                                                | No image content in this fixture.                                    |
| Tables                                          | Fixture contains no tables.                                                                                                                      | Data relationships are understandable.                          | **Not applicable.**                                                                                                                                | No table content in this fixture.                                    |
| Zoom and reflow                                 | No zoom or narrow-viewport check in this session.                                                                                                | Content remains available at increased zoom and narrow width.   | **Not tested.**                                                                                                                                    | Requires a separate recorded viewport/zoom session.                  |
| Fixed layout                                    | Not performed; fixture is reflowable.                                                                                                            | Fixed-layout content remains inspectable when enlarged.         | **Not applicable.**                                                                                                                                | This session used a reflowable fixture only.                         |
| Language                                        | No screen-reader language-announcement check.                                                                                                    | Publication language changes are announced appropriately.       | **Not tested.**                                                                                                                                    | Fixture content is English only.                                     |
| Reader panels/dialogs                           | Used Tab to reach Settings, Enter to open, Tab to move within, and Escape to close.                                                              | Dialog contains focus; dismissal restores focus to its trigger. | **Pass.** Focus stayed in the dialog and returned to Settings after Escape.                                                                        | Limited to Settings in this session.                                 |
| Errors / repeated entry / help / authentication | Used synthetic login values; no multi-step recovery or authentication alternatives tested.                                                       | Errors and repeated-entry behavior are accessible.              | **Not tested.**                                                                                                                                    | Login was only a route to the synthetic reader fixture.              |

### Defects

No additional defect was observed in this limited keyboard path after the annotation bar and import focus indicator fixes. This is not a claim that the reader or publication is accessible.

### Summary and limitations

- **Overall outcome for this session:** Keyboard-only path passed for the recorded routes, reader settings dialog, and synthetic EPUB frame.
- **Unresolved defects:** None identified in this narrow path; the NVDA/VoiceOver acceptance remains unverified.
- **Coverage not performed / reason:** NVDA/VoiceOver session, screen-reader reading order and announcements, image alternatives, tables, 200% zoom/narrow reflow, fixed-layout behavior, and language switching. NVDA was not installed; VoiceOver requires macOS.
- **Evidence retained and storage location (redacted/synthetic only):** Procedure and observations are recorded here. A transient screenshot of the synthetic reader/focus indicator was inspected but not retained in the repository.
- **Reviewer:** None.

This session record is limited evidence for the stated environment and actions. It is not a WCAG conformance statement or accessibility certification.
