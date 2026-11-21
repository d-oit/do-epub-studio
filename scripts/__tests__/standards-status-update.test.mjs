import { describe, expect, it } from 'vitest';
import {
  compareSnapshots,
  latestSnapshotPath,
  parseSpecPage,
  renderReport,
  sanitizeFingerprintText,
} from '../standards-status-update.mjs';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CONFIG_HTML = (shortName, status, date, subtitle) => `<!DOCTYPE html>
<html>
<head>
  <title>${subtitle ?? shortName}</title>
  <script id="initialUserConfig" type="application/json">
    {"specStatus":"${status}","shortName":"${shortName}","publishDate":"${date}","generatedSubtitle":"${subtitle}","gitRevision":"abc123"}
  </script>
</head>
<body>
  <h2 id="x1-introduction">1. Introduction</h2>
  <p>Some body text for ${shortName}.</p>
  <h3 id="x1-1-overview">1.1 Overview</h3>
  <p>More text.</p>
</body>
</html>`;

describe('parseSpecPage', () => {
  it('extracts status metadata from the initialUserConfig JSON', () => {
    const html = CONFIG_HTML(
      'epub-34',
      'CRD',
      '2026-11-16',
      'W3C Candidate Recommendation Draft 16 November 2026',
    );
    const record = parseSpecPage(html, 'epub-34');
    expect(record.specStatus).toBe('CRD');
    expect(record.publishDate).toBe('2026-11-16');
    expect(record.generatedSubtitle).toBe('W3C Candidate Recommendation Draft 16 November 2026');
    expect(record.gitRevision).toBe('abc123');
    expect(record.crEnd).toBeUndefined();
  });

  it('falls back to body-text status extraction when no config JSON exists', () => {
    const html =
      '<html><body><h2 id="x1-introduction">1. Introduction</h2>' +
      '<p>W3C Candidate Recommendation Draft 21 July 2026</p></body></html>';
    const record = parseSpecPage(html, 'epub-rs-34');
    expect(record.specStatus).toBe('Candidate Recommendation Draft');
    expect(record.generatedSubtitle).toBe('W3C Candidate Recommendation Draft 21 July 2026');
  });

  it('captures clause headings in document order', () => {
    const html = CONFIG_HTML('epub-33', 'REC', '2026-01-13', 'W3C Recommendation 13 January 2026');
    const record = parseSpecPage(html, 'epub-33');
    expect(record.headings).toEqual([
      { level: 2, id: 'x1-introduction', title: '1. Introduction' },
      { level: 3, id: 'x1-1-overview', title: '1.1 Overview' },
    ]);
  });

  it('produces a deterministic text fingerprint that changes with content', () => {
    const a = parseSpecPage(
      CONFIG_HTML(
        'epub-34',
        'CRD',
        '2026-11-16',
        'W3C Candidate Recommendation Draft 16 November 2026',
      ),
      'epub-34',
    );
    const b = parseSpecPage(
      CONFIG_HTML(
        'epub-34',
        'CRD',
        '2026-11-16',
        'W3C Candidate Recommendation Draft 16 November 2026',
      ),
      'epub-34',
    );
    const c = parseSpecPage(
      CONFIG_HTML(
        'epub-34',
        'CRD',
        '2026-11-16',
        'W3C Candidate Recommendation Draft 16 November 2026',
      ).replace('Some body text', 'Changed body text'),
      'epub-34',
    );
    expect(a.textHash).toBe(b.textHash);
    expect(a.textHash).not.toBe(c.textHash);
  });
  it('strips script/style blocks case-insensitively and removes unclosed script tags', () => {
    const html =
      CONFIG_HTML(
        'epub-34',
        'CRD',
        '2026-11-16',
        'W3C Candidate Recommendation Draft 16 November 2026',
      ) +
      '<SCRIPT>window.evil()</SCRIPT>' +
      '<script>window.evil2()</script>' +
      '<script src="https://evil.example/x.js">' +
      '<script type="x" data-a="<script">' +
      '<style>body{color:red}</style>' +
      '<p>clean text</p>' +
      '<p>closing with attrs</script \n bar></p>';
    const record = parseSpecPage(html, 'epub-34');
    expect(record.textHash).toMatch(/^[0-9a-f]{64}$/);
    const visibleText = sanitizeFingerprintText(html);
    expect(visibleText.toLowerCase()).not.toContain('<script');
    expect(visibleText.toLowerCase()).not.toContain('</script');
    expect(visibleText.toLowerCase()).not.toContain('<style');
    expect(visibleText.toLowerCase()).not.toContain('</style');
    expect(visibleText).toContain('clean text');
  });
});
const snapshot = (specs) => ({ generatedAt: '2026-11-19T00:00:00.000Z', specs });

describe('compareSnapshots', () => {
  it('reports a change when no previous snapshot exists', () => {
    const result = compareSnapshots(null, snapshot({ 'epub-34': { shortName: 'epub-34' } }));
    expect(result.changed).toBe(true);
    expect(result.entries[0]).toContain('No previous snapshot');
  });

  it('reports no change for identical snapshots', () => {
    const base = snapshot({
      'epub-34': {
        shortName: 'epub-34',
        specStatus: 'CRD',
        publishDate: '2026-11-16',
        headings: [{ id: 'x1-introduction', title: '1. Introduction' }],
        textHash: 'a',
      },
    });
    const result = compareSnapshots(base, base);
    expect(result.changed).toBe(false);
    expect(result.entries).toEqual([]);
  });

  it('detects status/date changes', () => {
    const prev = snapshot({
      'epub-34': { shortName: 'epub-34', specStatus: 'CRD', publishDate: '2026-11-16' },
    });
    const next = snapshot({
      'epub-34': { shortName: 'epub-34', specStatus: 'PR', publishDate: '2027-01-05' },
    });
    const result = compareSnapshots(prev, next);
    expect(result.changed).toBe(true);
    expect(result.entries).toEqual(
      expect.arrayContaining([
        '- epub-34 specStatus: CRD → PR',
        '- epub-34 publishDate: 2026-11-16 → 2027-01-05',
      ]),
    );
  });

  it('detects clause heading additions, drops and rewordings', () => {
    const prev = snapshot({
      'epub-34': {
        shortName: 'epub-34',
        headings: [
          { id: 'x1-introduction', title: '1. Introduction' },
          { id: 'x2-epub-publication-conformance', title: '2. EPUB publication conformance' },
        ],
      },
    });
    const next = snapshot({
      'epub-34': {
        shortName: 'epub-34',
        headings: [
          { id: 'x1-introduction', title: '1. Introduction' },
          {
            id: 'x2-epub-publication-conformance',
            title: '2. EPUB publication conformance (revised)',
          },
          { id: 'x9-aural-rendering', title: '9. Aural rendering' },
        ],
      },
    });
    const result = compareSnapshots(prev, next);
    expect(result.entries).toEqual(
      expect.arrayContaining([
        '- epub-34 new clause heading [x9-aural-rendering] 9. Aural rendering',
        expect.stringContaining('clause heading reworded [x2-epub-publication-conformance]'),
      ]),
    );
  });

  it('detects visible-text fingerprint changes', () => {
    const prev = snapshot({ 'epub-34': { shortName: 'epub-34', textHash: 'aaaa' } });
    const next = snapshot({ 'epub-34': { shortName: 'epub-34', textHash: 'bbbb' } });
    const result = compareSnapshots(prev, next);
    expect(result.changed).toBe(true);
    expect(result.entries[0]).toContain('visible-text fingerprint changed');
  });
});

describe('latestSnapshotPath', () => {
  it('picks the newest timestamped snapshot', () => {
    const dir = mkdtempSync(join(tmpdir(), 'w3c-snapshot-'));
    try {
      writeFileSync(join(dir, 'w3c-status-2026-11-01.json'), '{}');
      writeFileSync(join(dir, 'w3c-status-2026-11-19.json'), '{}');
      writeFileSync(join(dir, 'notes.txt'), 'ignored');
      expect(latestSnapshotPath(dir)).toBe(join(dir, 'w3c-status-2026-11-19.json'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('renderReport', () => {
  it('emits a markdown report with tracked status and changes', () => {
    const current = snapshot({
      'epub-34': {
        shortName: 'epub-34',
        specStatus: 'CRD',
        generatedSubtitle: 'W3C Candidate Recommendation Draft 16 November 2026',
        gitRevision: 'abc123',
      },
    });
    const report = renderReport(current, {
      changed: true,
      entries: ['- epub-34 specStatus: CRD → PR'],
    });
    expect(report).toContain('# W3C Standards Drift Review');
    expect(report).toContain(
      '**epub-34**: W3C Candidate Recommendation Draft 16 November 2026 (git abc123)',
    );
    expect(report).toContain('- epub-34 specStatus: CRD → PR');
    expect(report).toContain('commit');
  });
});
