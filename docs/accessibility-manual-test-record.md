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
