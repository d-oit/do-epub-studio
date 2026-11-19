import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { zipSync, strToU8 } from 'fflate';
import {
  parseFindings,
  parseJsonReport,
  normalizeFindingPath,
  metadataFromOpf,
  validateRootfilePath,
  extractRootfilePath,
  extractOpfFromZip,
  extractEpubVersion,
  EpubExtractionError,
  executeEpubcheck,
} from '../src/server.js';
import {
  EpubRunnerResultSchema,
  EPUBCHECK_VERSION,
} from '../../../packages/schema/src/schemas/epub-validation.js';

describe('epubcheck runner helper functions', () => {
  it('parses findings from EPUBCheck text output', () => {
    const sampleOutput = [
      'EpubCheck v5.4.0',
      'ERROR(RSC-005): file.epub/OEBPS/ch1.xhtml(10,5): Error message here',
      'WARNING(ACC-001): file.epub/OEBPS/ch1.xhtml: Warning message',
      'INFO(HTM-001): file.epub: Info message',
      'FATAL(PKG-004): file.epub: Corrupted package header',
    ].join('\n');

    const findings = parseFindings(sampleOutput);
    assert.equal(findings.length, 4);
    assert.equal(findings[0]?.severity, 'error');
    assert.equal(findings[0]?.code, 'RSC-005');
    assert.equal(findings[0]?.path, 'OEBPS/ch1.xhtml');
    assert.equal(findings[0]?.location, '10:5');
    assert.equal(findings[0]?.message, 'Error message here');

    assert.equal(findings[1]?.severity, 'warning');
    assert.equal(findings[1]?.code, 'ACC-001');
    assert.equal(findings[1]?.path, 'OEBPS/ch1.xhtml');
    assert.equal(findings[1]?.location, null);
    assert.equal(findings[1]?.message, 'Warning message');

    assert.equal(findings[2]?.severity, 'info');
    assert.equal(findings[2]?.code, 'HTM-001');
    assert.equal(findings[2]?.path, null);
    assert.equal(findings[2]?.location, null);
    assert.equal(findings[2]?.message, 'Info message');

    assert.equal(findings[3]?.severity, 'error');
    assert.equal(findings[3]?.code, 'PKG-004');
    assert.equal(findings[3]?.message, 'Corrupted package header');
  });

  it('extracts accessibility metadata from OPF content', () => {
    const sampleOpf = `
      <package version="3.0">
        <metadata>
          <dc:language>en</dc:language>
          <schema:accessMode>textual</schema:accessMode>
          <schema:accessibilitySummary>This is a synthetic accessible book.</schema:accessibilitySummary>
        </metadata>
      </package>
    `;

    const metadata = metadataFromOpf(sampleOpf);
    assert.equal(metadata.length, 3);
    assert.deepEqual(metadata[0], { key: 'dc:language', value: 'en', provenance: 'opf' });
    assert.deepEqual(metadata[1], {
      key: 'schema:accessMode',
      value: 'textual',
      provenance: 'opf',
    });
    assert.deepEqual(metadata[2], {
      key: 'schema:accessibilitySummary',
      value: 'This is a synthetic accessible book.',
      provenance: 'opf',
    });
  });

  it('extracts full accessibility metadata and conformance from EPUB 3 meta tags', () => {
    const opf = `
      <package version="3.0" xmlns="http://www.idpf.org/2007/opf">
        <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
          <dc:language>en-US</dc:language>
          <meta property="schema:accessMode">textual</meta>
          <meta property="schema:accessMode">visual</meta>
          <meta property="schema:accessModeSufficient">textual</meta>
          <meta property="schema:accessibilityFeature">structuralNavigation</meta>
          <meta property="schema:accessibilityFeature">alternativeText</meta>
          <meta property="schema:accessibilityHazard">none</meta>
          <meta property="schema:accessibilitySummary">Full accessible manual.</meta>
          <meta property="schema:accessibilityControl">fullKeyboardControl</meta>
          <meta property="schema:accessibilityAPI">ARIA</meta>
          <meta property="dcterms:conformsTo">EPUB Accessibility 1.1 - WCAG 2.2 Level AA</meta>
          <meta property="a11y:certifiedBy">Auditor Name</meta>
          <meta property="a11y:certifierCredential">Trusted Credentials</meta>
          <meta name="schema:accessibilityFeature" content="tableOfContents"/>
        </metadata>
      </package>
    `;

    const metadata = metadataFromOpf(opf);
    const keys = metadata.map((item) => item.key);
    assert.ok(keys.includes('dc:language'));
    assert.ok(keys.includes('schema:accessMode'));
    assert.ok(keys.includes('schema:accessModeSufficient'));
    assert.ok(keys.includes('schema:accessibilityFeature'));
    assert.ok(keys.includes('schema:accessibilityHazard'));
    assert.ok(keys.includes('schema:accessibilitySummary'));
    assert.ok(keys.includes('schema:accessibilityControl'));
    assert.ok(keys.includes('schema:accessibilityAPI'));
    assert.ok(keys.includes('dcterms:conformsTo'));
    assert.ok(keys.includes('a11y:certifiedBy'));

    const features = metadata.filter((item) => item.key === 'schema:accessibilityFeature');
    assert.equal(features.length, 3);
    assert.deepEqual(
      features.map((f) => f.value),
      ['structuralNavigation', 'alternativeText', 'tableOfContents'],
    );
  });

  it('extracts EPUB package version from package element', () => {
    assert.equal(extractEpubVersion('<package version="3.0">'), '3.0');
    assert.equal(
      extractEpubVersion('<package xmlns="http://www.idpf.org/2007/opf" version="2.0">'),
      '2.0',
    );
    assert.equal(extractEpubVersion('<package version="3.4" unique-identifier="uid">'), '3.4');
    assert.equal(extractEpubVersion('<package id="pkg">'), null);
    assert.equal(extractEpubVersion(''), null);
  });

  it('validates and normalizes rootfile path safely', () => {
    assert.equal(validateRootfilePath('OEBPS/content.opf'), 'OEBPS/content.opf');
    assert.equal(validateRootfilePath('content.opf'), 'content.opf');
    assert.equal(validateRootfilePath('EPUB/package.opf'), 'EPUB/package.opf');

    assert.throws(() => validateRootfilePath(''), {
      name: 'EpubExtractionError',
      code: 'INVALID_PACKAGE_PATH',
    });
    assert.throws(() => validateRootfilePath('/OEBPS/content.opf'), {
      name: 'EpubExtractionError',
      code: 'INVALID_PACKAGE_PATH',
    });
    assert.throws(() => validateRootfilePath('../secret.opf'), {
      name: 'EpubExtractionError',
      code: 'INVALID_PACKAGE_PATH',
    });
    assert.throws(() => validateRootfilePath('OEBPS/../secret.opf'), {
      name: 'EpubExtractionError',
      code: 'INVALID_PACKAGE_PATH',
    });
    assert.throws(() => validateRootfilePath('OEBPS\\content.opf'), {
      name: 'EpubExtractionError',
      code: 'INVALID_PACKAGE_PATH',
    });
    assert.throws(() => validateRootfilePath('C:/content.opf'), {
      name: 'EpubExtractionError',
      code: 'INVALID_PACKAGE_PATH',
    });
  });

  it('extracts primary rootfile path from container XML', () => {
    const standard = `<?xml version="1.0"?>
      <container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
        <rootfiles>
          <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
        </rootfiles>
      </container>`;
    assert.equal(extractRootfilePath(standard), 'OEBPS/content.opf');

    const multiple = `<?xml version="1.0"?>
      <container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
        <rootfiles>
          <rootfile full-path="other/random.xml" media-type="application/other"/>
          <rootfile full-path="EPUB/package.opf" media-type="application/oebps-package+xml"/>
        </rootfiles>
      </container>`;
    assert.equal(extractRootfilePath(multiple), 'EPUB/package.opf');

    const none = '<container><rootfiles></rootfiles></container>';
    assert.equal(extractRootfilePath(none), null);
  });

  it('extracts OPF content from a complete synthetic EPUB archive', () => {
    const opfContent = `<?xml version="1.0"?>
      <package version="3.0" xmlns="http://www.idpf.org/2007/opf">
        <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
          <dc:language>en</dc:language>
          <meta property="schema:accessMode">textual</meta>
        </metadata>
      </package>`;
    const containerXml = `<?xml version="1.0"?>
      <container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
        <rootfiles>
          <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
        </rootfiles>
      </container>`;

    const epubBytes = zipSync({
      mimetype: strToU8('application/epub+zip'),
      'META-INF/container.xml': strToU8(containerXml),
      'OEBPS/content.opf': strToU8(opfContent),
    });

    const extraction = extractOpfFromZip(epubBytes);
    assert.equal(extraction.opfPath, 'OEBPS/content.opf');
    assert.ok(extraction.opf?.includes('schema:accessMode'));

    const version = extractEpubVersion(extraction.opf!);
    assert.equal(version, '3.0');

    const metadata = metadataFromOpf(extraction.opf!);
    assert.equal(metadata.length, 2);
  });

  it('fails safely on malformed rootfile path inside container XML', () => {
    const containerXml = `<?xml version="1.0"?>
      <container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
        <rootfiles>
          <rootfile full-path="../escape/content.opf" media-type="application/oebps-package+xml"/>
        </rootfiles>
      </container>`;

    const epubBytes = zipSync({
      'META-INF/container.xml': strToU8(containerXml),
    });

    assert.throws(
      () => extractOpfFromZip(epubBytes),
      (err: unknown) => {
        assert.ok(err instanceof EpubExtractionError);
        assert.equal(err.code, 'INVALID_PACKAGE_PATH');
        return true;
      },
    );
  });

  it('returns null OPF when container.xml is absent from archive', () => {
    const epubBytes = zipSync({
      'OEBPS/content.opf': strToU8('<package/>'),
    });

    const extraction = extractOpfFromZip(epubBytes);
    assert.equal(extraction.opf, null);
    assert.equal(extraction.opfPath, null);
  });

  it('validates synthesized runner results against EpubRunnerResultSchema', () => {
    const opf = `
      <package version="3.0">
        <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
          <dc:language>en</dc:language>
          <meta property="schema:accessibilitySummary">Accessible text</meta>
        </metadata>
      </package>`;
    const metadata = metadataFromOpf(opf);
    const version = extractEpubVersion(opf);

    const withMetadata = {
      validatorVersion: EPUBCHECK_VERSION,
      sha256: '0'.repeat(64),
      epubVersion: version,
      safetyStatus: 'accepted' as const,
      conformanceStatus: 'completed' as const,
      findings: [],
      accessibility: {
        metadata,
        advisories: [
          {
            category: 'language' as const,
            message: 'Language advisory',
            source: 'manual-review' as const,
          },
        ],
        manualReviewRequired: true,
        certification: 'not-certified' as const,
      },
    };

    const parsedWith = EpubRunnerResultSchema.parse(withMetadata);
    assert.equal(parsedWith.epubVersion, '3.0');
    assert.equal(parsedWith.accessibility.metadata.length, 2);
    assert.equal(parsedWith.accessibility.metadata[0]?.key, 'dc:language');
    assert.equal(parsedWith.accessibility.metadata[0]?.value, 'en');

    const withoutMetadata = {
      ...withMetadata,
      epubVersion: null,
      accessibility: {
        ...withMetadata.accessibility,
        metadata: [],
      },
    };

    const parsedWithout = EpubRunnerResultSchema.parse(withoutMetadata);
    assert.equal(parsedWithout.epubVersion, null);
    assert.equal(parsedWithout.accessibility.metadata.length, 0);
  });
  it('parses findings from structured EPUBCheck JSON report', () => {
    const sampleJson = JSON.stringify({
      messages: [
        {
          id: 'RSC-005',
          severity: 'ERROR',
          message: 'Error in chapter',
          locations: [
            {
              path: '/service/tmp/epubcheck-1234/input.epub/OEBPS/ch1.xhtml',
              line: 42,
              column: 17,
            },
          ],
        },
        {
          id: 'CSS-001',
          severity: 'WARNING',
          message: 'Unknown CSS property',
          locations: [
            {
              path: 'OEBPS/styles/style.css',
              line: 88,
              column: -1,
            },
          ],
        },
        {
          id: 'OPF-015',
          severity: 'ERROR',
          message: 'Invalid OPF declaration',
          locations: [
            {
              path: 'OEBPS/content.opf',
              line: -1,
              column: -1,
            },
          ],
        },
        {
          id: 'PKG-004',
          severity: 'FATAL',
          message: 'Corrupted package header',
          locations: [
            {
              path: 'input.epub',
              line: 0,
              column: 0,
            },
          ],
        },
      ],
    });

    const findings = parseJsonReport(sampleJson);
    assert.equal(findings.length, 4);

    assert.equal(findings[0]?.severity, 'error');
    assert.equal(findings[0]?.code, 'RSC-005');
    assert.equal(findings[0]?.path, 'OEBPS/ch1.xhtml');
    assert.equal(findings[0]?.location, '42:17');
    assert.equal(findings[0]?.message, 'Error in chapter');

    assert.equal(findings[1]?.severity, 'warning');
    assert.equal(findings[1]?.code, 'CSS-001');
    assert.equal(findings[1]?.path, 'OEBPS/styles/style.css');
    assert.equal(findings[1]?.location, 'line 88');

    assert.equal(findings[2]?.severity, 'error');
    assert.equal(findings[2]?.code, 'OPF-015');
    assert.equal(findings[2]?.path, 'OEBPS/content.opf');
    assert.equal(findings[2]?.location, null);

    assert.equal(findings[3]?.severity, 'error');
    assert.equal(findings[3]?.code, 'PKG-004');
    assert.equal(findings[3]?.path, null);
    assert.equal(findings[3]?.location, null);
  });

  it('normalizes finding paths and strips runner temporary prefixes', () => {
    assert.equal(
      normalizeFindingPath('/tmp/epubcheck-123/book.epub/OEBPS/nav.xhtml'),
      'OEBPS/nav.xhtml',
    );
    assert.equal(
      normalizeFindingPath('file:/tmp/runner/book.epub!/EPUB/package.opf'),
      'EPUB/package.opf',
    );
    assert.equal(normalizeFindingPath('OEBPS\\chapter.xhtml'), 'OEBPS/chapter.xhtml');
    assert.equal(normalizeFindingPath('book.epub'), null);
    assert.equal(normalizeFindingPath('/tmp/runner/input.epub'), null);
    assert.equal(normalizeFindingPath(null), null);
  });
});

describe('EPUBCheck runtime limit', () => {
  it('kills a validator that exceeds its runtime and reports a timeout', async () => {
    const workDir = mkdtempSync(join(tmpdir(), 'epubcheck-timeout-'));
    const javaBin = join(workDir, 'java');
    writeFileSync(javaBin, "#!/bin/sh\nexec node -e 'setTimeout(() => {}, 10000)'\n", {
      mode: 0o755,
    });
    const previousJavaBin = process.env.EPUBCHECK_JAVA_BIN;
    process.env.EPUBCHECK_JAVA_BIN = javaBin;

    try {
      await assert.rejects(
        executeEpubcheck(join(workDir, 'input.epub'), workDir, 25),
        /validator_timeout/,
      );
    } finally {
      if (previousJavaBin === undefined) delete process.env.EPUBCHECK_JAVA_BIN;
      else process.env.EPUBCHECK_JAVA_BIN = previousJavaBin;
      rmSync(workDir, { recursive: true, force: true });
    }
  });
});
describe('epubcheck runner HTTP integration', () => {
  // Real clock polling is required: readiness depends on an external child
  // process starting, which cannot be driven by fake timers.
  async function waitForHealth(port: number, timeoutMs = 10_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        const res = await fetch(`http://127.0.0.1:${port}/health`);
        if (res.ok) return;
      } catch {
        /* server not up yet */
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error('validator server did not become healthy');
  }

  it('returns 503, never a false 200, when Java exits nonzero without usable findings', async () => {
    const fakeJavaDir = mkdtempSync(join(tmpdir(), 'epubcheck-fakejava-'));
    const javaBin = join(fakeJavaDir, 'java');
    writeFileSync(javaBin, '#!/bin/sh\nexit 1\n', { mode: 0o755 });
    const port = 18_000 + Math.floor(Math.random() * 500);
    const token = 'runner-token';
    const child = spawn(process.execPath, ['--import', 'tsx', 'src/server.ts'], {
      cwd: join(import.meta.dirname, '..'),
      env: {
        ...process.env,
        PORT: String(port),
        PATH: `${fakeJavaDir}:${process.env.PATH ?? ''}`,
        EPUBCHECK_RUNNER_TOKEN: token,
        EPUBCHECK_JAR_PATH: join(fakeJavaDir, 'epubcheck.jar'),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    try {
      await waitForHealth(port);
      const epubBytes = zipSync({
        mimetype: strToU8('application/epub+zip'),
        'META-INF/container.xml': strToU8(
          '<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
        ),
        'content.opf': strToU8('<package version="3.0"/>'),
      });
      const res = await fetch(`http://127.0.0.1:${port}/validate`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/epub+zip',
        },
        body: epubBytes,
      });
      assert.equal(res.status, 503);
      const body = (await res.json()) as { error?: string };
      assert.equal(body.error, 'runner_unavailable');
    } finally {
      const childClosed = new Promise<void>((resolve) => {
        if (child.exitCode !== null || child.signalCode !== null) resolve();
        else child.once('close', () => resolve());
      });
      child.kill('SIGKILL');
      await childClosed;
      rmSync(fakeJavaDir, { recursive: true, force: true });
    }
  });
});
