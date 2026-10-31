import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseFindings, metadataFromOpf } from '../src/server.js';

describe('epubcheck runner helper functions', () => {
  it('parses findings from EPUBCheck text output', () => {
    const sampleOutput = [
      'EpubCheck v5.4.0',
      'ERROR(RSC-005): file.epub/OEBPS/ch1.xhtml(10,5): Error message here',
      'WARNING(ACC-001): file.epub/OEBPS/ch1.xhtml: Warning message',
      'INFO(HTM-001): file.epub: Info message',
    ].join('\n');

    const findings = parseFindings(sampleOutput);
    assert.equal(findings.length, 3);
    assert.equal(findings[0]?.severity, 'error');
    assert.equal(findings[0]?.code, 'RSC-005');
    assert.equal(findings[1]?.severity, 'warning');
    assert.equal(findings[1]?.code, 'ACC-001');
    assert.equal(findings[2]?.severity, 'info');
    assert.equal(findings[2]?.code, 'HTM-001');
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
});
