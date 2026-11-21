import type { AccessibilityContentContext } from '../../epub-accessibility';

/**
 * Fixture OPF/nav pairs for EPUB Accessibility 1.2 (CR Draft) metadata checks.
 *
 * `positive`: complete, coherent discovery + conformance + evaluator metadata
 * with a navigation document that supports every declared nav feature.
 *
 * `negative`: minimal package that omits 1.2-required discoverability metadata
 * and declares no conformance claim.
 *
 * `contradictory`: conflicting hazard, access-mode, conformance-claim, and
 * nav declarations, plus a local evaluator report that does not resolve.
 */
export interface MetadataFixture {
  opfXml: string;
  context: AccessibilityContentContext;
}

const NAV_FULL = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>Navigation</title></head>
<body>
  <nav epub:type="toc"><h1>Contents</h1><ol><li><a href="ch1.xhtml">Chapter 1</a></li></ol></nav>
  <nav epub:type="page-list"><h1>Pages</h1><ol><li><a href="ch1.xhtml#p1">1</a></li></ol></nav>
  <nav epub:type="landmarks"><h1>Guide</h1><ol><li><a href="ch1.xhtml">Start</a></li></ol></nav>
</body>
</html>`;

const NAV_NO_PAGE_LIST = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>Navigation</title></head>
<body>
  <nav epub:type="toc"><h1>Contents</h1><ol><li><a href="ch1.xhtml">Chapter 1</a></li></ol></nav>
  <nav epub:type="landmarks"><h1>Guide</h1><ol><li><a href="ch1.xhtml">Start</a></li></ol></nav>
</body>
</html>`;

const RESOURCES = [
  'OEBPS/content.opf',
  'OEBPS/nav.xhtml',
  'OEBPS/ch1.xhtml',
  'OEBPS/ch2.xhtml',
  'OEBPS/reports/a11y.xhtml',
];

const CONTEXT_POSITIVE: AccessibilityContentContext = {
  navXml: NAV_FULL,
  navPath: 'OEBPS/nav.xhtml',
  resources: RESOURCES,
  spinePaths: ['OEBPS/ch1.xhtml', 'OEBPS/ch2.xhtml'],
};

const OPF_WRAPPER_START = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
    <dc:identifier id="bookid">urn:uuid:00000000-0000-0000-0000-000000000001</dc:identifier>
    <dc:title>Fixture Book</dc:title>
    <dc:language>en</dc:language>
`;

const OPF_WRAPPER_END = `  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml"/>
    <item id="ch2" href="ch2.xhtml" media-type="application/xhtml+xml"/>
    <item id="report" href="reports/a11y.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="ch1"/>
    <itemref idref="ch2"/>
  </spine>
</package>`;

export const METADATA_FIXTURES: Record<'positive' | 'negative' | 'contradictory', MetadataFixture> =
  {
    positive: {
      opfXml: `${OPF_WRAPPER_START}
    <meta property="schema:accessMode">textual</meta>
    <meta property="schema:accessMode">visual</meta>
    <meta property="schema:accessModeSufficient">textual</meta>
    <meta property="schema:accessModeSufficient">visual</meta>
    <meta property="schema:accessibilityFeature">structuralNavigation</meta>
    <meta property="schema:accessibilityFeature">tableOfContents</meta>
    <meta property="schema:accessibilityFeature">pageNavigation</meta>
    <meta property="schema:accessibilityFeature">alternativeText</meta>
    <meta property="schema:accessibilityHazard">none</meta>
    <meta property="schema:accessibilitySummary">Fully navigable with alternative text.</meta>
    <meta property="dcterms:conformsTo">EPUB Accessibility 1.2 - WCAG 2.2 Level AA</meta>
    <meta property="a11y:certifiedBy">Accessibility Testers Group</meta>
    <meta property="a11y:certifierCredential">DAISY OK</meta>
    <meta property="dcterms:date">2026-11-01</meta>
    <meta property="a11y:contactEmail">a11y@example.com</meta>
    <link rel="a11y:certifierReport" href="https://example.com/reports/9780000000001"/>
${OPF_WRAPPER_END}`,
      context: CONTEXT_POSITIVE,
    },
    negative: {
      opfXml: `${OPF_WRAPPER_START}
    <meta property="schema:accessMode">textual</meta>
    <meta property="schema:accessibilityFeature">structuralNavigation</meta>
${OPF_WRAPPER_END}`,
      context: { navXml: NAV_FULL, navPath: 'OEBPS/nav.xhtml', resources: RESOURCES },
    },
    contradictory: {
      opfXml: `${OPF_WRAPPER_START}
    <meta property="schema:accessMode">textual</meta>
    <meta property="schema:accessModeSufficient">visual</meta>
    <meta property="schema:accessibilityFeature">structuralNavigation</meta>
    <meta property="schema:accessibilityFeature">tableOfContents</meta>
    <meta property="schema:accessibilityFeature">pageNavigation</meta>
    <meta property="schema:accessibilityHazard">none</meta>
    <meta property="schema:accessibilityHazard">flashing</meta>
    <meta property="dcterms:conformsTo">EPUB Accessibility 1.1 - WCAG 2.1 Level AA</meta>
    <meta property="dcterms:conformsTo">EPUB Accessibility 1.2 - WCAG 2.2 Level AA</meta>
    <meta property="a11y:certifiedBy">Self</meta>
    <meta property="dcterms:date">not-a-date</meta>
    <meta property="a11y:contactEmail">not-an-email</meta>
    <link rel="a11y:certifierReport" href="reports/missing.xhtml"/>
${OPF_WRAPPER_END}`,
      context: {
        navXml: NAV_NO_PAGE_LIST,
        navPath: 'OEBPS/nav.xhtml',
        resources: RESOURCES,
        spinePaths: ['OEBPS/ch1.xhtml', 'OEBPS/ch2.xhtml'],
      },
    },
  };
