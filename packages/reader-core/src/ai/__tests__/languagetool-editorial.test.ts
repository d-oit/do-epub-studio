/**
 * @vitest-environment node
 *
 * LanguageTool adapter — deterministic unit tests (GOAP-273 Phase A2).
 *
 * The engine is faked at the fetch boundary (`FetchLike`), so everything here
 * runs offline: mapping to grounded findings, the ADR-274 D6 approved-term
 * filter, request gating, `hasEngine()` last-contact semantics, and every
 * honest unavailability reason. Live engine behaviour belongs in
 * `languagetool-editorial.live.test.ts` (opt-in via E2E_LIVE=1).
 */

import { describe, expect, it } from 'vitest';
import { validateEditorialFindings, type EditorialFinding } from '../editorial-findings';
import { effectiveCategoryAvailability, type QualificationMilestone } from '../qualification';
import {
  createLanguageToolEditorialPlugin,
  type FetchLike,
  type LanguageToolEditorialCapability,
} from '../plugins/languagetool-editorial';
import type { EditorialReviewRequest } from '../types';

const TEXT_1 = 'The doors was locked.';
const CHAPTER_SHA = 'sha256:unit';

interface FetchCall {
  input: string | URL;
  init?: RequestInit;
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** Fetch seam that records every call; the handler may throw to simulate failure. */
function stub(handler: (call: FetchCall) => Response | Promise<Response>): {
  fetchImpl: FetchLike;
  calls: FetchCall[];
} {
  const calls: FetchCall[] = [];
  const fetchImpl: FetchLike = (input, init) => {
    const call: FetchCall = { input, init };
    calls.push(call);
    try {
      return Promise.resolve(handler(call));
    } catch (err) {
      return Promise.reject(err instanceof Error ? err : new Error(String(err)));
    }
  };
  return { fetchImpl, calls };
}

function ltBody(matches: unknown[], extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    software: { name: 'LanguageTool', version: '6.9-SNAPSHOT' },
    sentenceRanges: [[0, TEXT_1.length]],
    matches,
    ...extra,
  };
}

function ltMatch(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    message: 'Possible spelling mistake found.',
    offset: 0,
    length: 3,
    replacements: [{ value: 'the' }],
    rule: { id: 'RULE_X', category: { id: 'TYPOS' } },
    ...overrides,
  };
}

function request(overrides: Partial<EditorialReviewRequest> = {}): EditorialReviewRequest {
  return {
    categories: ['spelling'],
    chapterText: { c1: TEXT_1 },
    chapterSha256: { c1: CHAPTER_SHA },
    references: {},
    styleRevision: 7,
    language: 'en-US',
    ...overrides,
  };
}

function capabilityWith(
  fetchImpl: FetchLike,
  options: { baseUrl?: string; engine?: string; model?: string } = {},
): LanguageToolEditorialCapability {
  return createLanguageToolEditorialPlugin({ fetchImpl, ...options }).capabilities.editorial;
}

async function runOk(
  capability: LanguageToolEditorialCapability,
  req: EditorialReviewRequest,
): Promise<EditorialFinding[]> {
  const outcome = await capability.review(req);
  if (outcome.status !== 'ok') {
    const reason = outcome.status === 'unavailable' ? `: ${outcome.reason}` : '';
    throw new Error(`expected ok outcome, received ${outcome.status}${reason}`);
  }
  return outcome.findings;
}

describe('LanguageTool adapter — mapping', () => {
  it('maps an agreement match to a grounded grammar finding with sentence context', async () => {
    const agreement = ltMatch({
      message: 'You should probably use: “were”.',
      offset: 10,
      length: 3,
      replacements: [{ value: 'were' }],
      rule: { id: 'AGREEMENT_SENT_START', category: { id: 'GRAMMAR' } },
    });
    // Deliberately noisy ranges: a junk entry and an out-of-range pair must
    // fall through to the valid [0, 21] sentence instead of breaking mapping.
    const { fetchImpl, calls } = stub(() =>
      jsonResponse(ltBody([agreement], { sentenceRanges: ['junk', [999, 200], [0, 21]] })),
    );
    const capability = capabilityWith(fetchImpl);
    const findings = await runOk(capability, request({ categories: ['grammar'] }));

    expect(findings).toHaveLength(1);
    const finding = findings[0];
    if (!finding) throw new Error('missing finding');
    expect(finding).toMatchObject({
      category: 'grammar',
      severity: 'suggestion',
      uncertainty: 'none',
      replacement: 'were',
      explanation: 'You should probably use: “were”.',
      referenceIds: [],
      referenceRevisions: {},
      styleRevision: 7,
      provenance: {
        engine: 'LanguageTool',
        model: '6.9-SNAPSHOT',
        ruleId: 'AGREEMENT_SENT_START',
      },
    });
    const span = finding.spans[0];
    if (!span) throw new Error('missing span');
    expect(span).toMatchObject({
      chapterRef: 'c1',
      cfi: null,
      quote: TEXT_1,
      sourceSha256: CHAPTER_SHA,
      start: 10,
      end: 13,
    });

    expect(calls).toHaveLength(1);
    const call = calls[0];
    if (!call) throw new Error('missing fetch call');
    expect(String(call.input)).toBe('http://127.0.0.1:8081/v2/check');
    expect(call.init?.method).toBe('POST');
    expect(call.init?.body).toBeInstanceOf(URLSearchParams);
    const params = call.init?.body as URLSearchParams;
    expect(params.get('language')).toBe('en-US');
    expect(params.get('text')).toBe(TEXT_1);

    // The trust boundary accepts the mapped finding independently of the adapter.
    const validation = validateEditorialFindings(findings, {
      chapterText: { c1: TEXT_1 },
      chapterSha256: { c1: CHAPTER_SHA },
      referenceRevisions: {},
      styleRevision: 7,
    });
    expect(validation.rejected).toHaveLength(0);
    expect(validation.accepted).toHaveLength(1);
    // Corpus item 8 at adapter level: byte-for-byte outside the cited span.
    expect(`${TEXT_1.slice(0, 10)}were${TEXT_1.slice(13)}`).toBe('The doors were locked.');
  });

  it('falls back to the matched fragment when sentence ranges are absent', async () => {
    const match = ltMatch({
      offset: 10,
      length: 3,
      replacements: [{ value: 'were' }],
      rule: { id: 'AGREEMENT_SENT_START', category: { id: 'GRAMMAR' } },
    });
    const { fetchImpl } = stub(() => jsonResponse(ltBody([match], { sentenceRanges: undefined })));
    const findings = await runOk(capabilityWith(fetchImpl), request({ categories: ['grammar'] }));
    expect(findings[0]?.spans[0]).toMatchObject({ quote: 'was', start: 0, end: 3 });
  });

  it('maps rule categories to spelling/grammar and drops everything else', async () => {
    const matches = [
      ltMatch({ offset: 0, length: 3, rule: { id: 'T', category: { id: 'TYPOS' } } }),
      ltMatch({ offset: 4, length: 1, rule: { id: 'P', category: { id: 'PUNCTUATION' } } }),
      ltMatch({ offset: 8, length: 5, rule: { id: 'S', category: { id: 'STYLE' } } }),
      ltMatch({ offset: 8, length: 5, rule: { id: 'X', category: { id: 'SOMETHING_NEW' } } }),
    ];
    const { fetchImpl } = stub(() => jsonResponse(ltBody(matches)));
    const findings = await runOk(
      capabilityWith(fetchImpl),
      request({ categories: ['spelling', 'grammar'] }),
    );
    expect(findings.map((finding) => finding.category).sort()).toEqual(['grammar', 'spelling']);
  });

  it('returns only the categories the caller requested', async () => {
    const matches = [
      ltMatch({ offset: 0, length: 3, rule: { id: 'T', category: { id: 'TYPOS' } } }),
      ltMatch({ offset: 4, length: 1, rule: { id: 'G', category: { id: 'GRAMMAR' } } }),
    ];
    const { fetchImpl } = stub(() => jsonResponse(ltBody(matches)));
    const findings = await runOk(capabilityWith(fetchImpl), request());
    expect(findings).toHaveLength(1);
    expect(findings[0]?.category).toBe('spelling');
  });

  it('drops matches overlapping creator-approved terms (ADR-274 D6)', async () => {
    const chapter = 'Mariselleth smiled. Teh cat sat.';
    const matches = [
      ltMatch({ offset: 0, length: 11, replacements: [{ value: 'Marielle' }] }),
      ltMatch({ offset: 20, length: 3, replacements: [{ value: 'The' }] }),
    ];
    const { fetchImpl } = stub(() =>
      jsonResponse(
        ltBody(matches, {
          sentenceRanges: [
            [0, 19],
            [20, 32],
          ],
        }),
      ),
    );
    const findings = await runOk(
      capabilityWith(fetchImpl),
      request({ chapterText: { c1: chapter }, approvedTerms: ['Mariselleth', ''] }),
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.spans[0]).toMatchObject({ quote: 'Teh cat sat.', start: 0, end: 3 });
  });

  it('treats absent, no-op and malformed replacements as questions, not suggestions', async () => {
    const cases = [
      ltMatch({ offset: 10, length: 3, replacements: [] }),
      ltMatch({ offset: 10, length: 3, replacements: [{ value: 'was' }] }),
      ltMatch({ offset: 10, length: 3, replacements: 'nope' }),
    ];
    for (const match of cases) {
      const { fetchImpl } = stub(() => jsonResponse(ltBody([match])));
      const findings = await runOk(capabilityWith(fetchImpl), request());
      const outcome = findings[0];
      expect(outcome).toMatchObject({
        replacement: null,
        severity: 'question',
        uncertainty: 'review_needed',
      });
    }
  });

  it('honours provenance overrides and reports an unknown model when none was discovered', async () => {
    const bareBody = { matches: [ltMatch({ offset: 10, length: 3 })], sentenceRanges: [[0, 21]] };
    const { fetchImpl: overridden } = stub(() => jsonResponse(bareBody));
    const withOverride = await runOk(
      capabilityWith(overridden, { engine: 'LT-test', model: 'unit-model' }),
      request(),
    );
    expect(withOverride[0]?.provenance).toEqual({
      engine: 'LT-test',
      model: 'unit-model',
      ruleId: 'RULE_X',
    });

    const { fetchImpl: bare } = stub(() => jsonResponse(bareBody));
    const withoutSoftware = await runOk(capabilityWith(bare), request());
    expect(withoutSoftware[0]?.provenance.model).toBe('unknown');
  });
});

describe('LanguageTool adapter — health probe', () => {
  it('stays fail-closed until a probe shows the service answering', async () => {
    const { fetchImpl } = stub(() => jsonResponse(ltBody([])));
    const capability = capabilityWith(fetchImpl);
    expect(capability.hasEngine()).toBe(false);
    expect(await capability.probe()).toBe(true);
    expect(capability.hasEngine()).toBe(true);
  });

  it('reports down when the probe cannot reach the service', async () => {
    const { fetchImpl } = stub(() => {
      throw new TypeError('fetch failed');
    });
    const capability = capabilityWith(fetchImpl);
    expect(await capability.probe()).toBe(false);
    expect(capability.hasEngine()).toBe(false);
  });

  it('treats an HTTP error response to a probe as presence, not health', async () => {
    const { fetchImpl } = stub(() => jsonResponse({}, 503));
    const capability = capabilityWith(fetchImpl);
    expect(await capability.probe()).toBe(true);
    expect(capability.hasEngine()).toBe(true);
  });

  it('replaces engine_missing only where the engine truly answers (milestone composition)', async () => {
    const qualified: QualificationMilestone[] = [
      {
        id: 'local-engine',
        status: 'met',
        qualifiedAt: new Date().toISOString(),
        categories: ['spelling', 'grammar'],
        notes: 'synthetic milestone — composition test only',
      },
    ];

    // Nobody has contacted the engine: a met milestone alone cannot claim availability.
    const fresh = capabilityWith(stub(() => jsonResponse(ltBody([]))).fetchImpl);
    expect(
      effectiveCategoryAvailability('grammar', {
        enginePresent: fresh.hasEngine(),
        milestones: qualified,
      }),
    ).toBe('engine_missing');

    // The engine truly answers: milestone AND engine together read available.
    const answered = capabilityWith(stub(() => jsonResponse(ltBody([]))).fetchImpl);
    expect(await answered.review(request({ categories: ['grammar'] }))).toEqual({
      status: 'no_supported_findings',
    });
    expect(answered.hasEngine()).toBe(true);
    expect(
      effectiveCategoryAvailability('grammar', {
        enginePresent: answered.hasEngine(),
        milestones: qualified,
      }),
    ).toBe('available');
    // With no recorded milestone, presence alone still reports engine_missing.
    expect(
      effectiveCategoryAvailability('grammar', {
        enginePresent: answered.hasEngine(),
        milestones: [],
      }),
    ).toBe('engine_missing');
  });
});

describe('LanguageTool adapter — request gating', () => {
  it('refuses story/logic, mixed and empty category requests without calling the engine', async () => {
    const { fetchImpl, calls } = stub(() => jsonResponse(ltBody([])));
    const capability = capabilityWith(fetchImpl);
    for (const categories of [['story'], ['spelling', 'story'], []] as const) {
      const outcome = await capability.review(request({ categories }));
      expect(outcome).toEqual({ status: 'unavailable', reason: 'incomplete_analysis' });
    }
    expect(calls).toHaveLength(0);
  });

  it('reports unsupported_language for a missing language without calling the engine', async () => {
    const { fetchImpl, calls } = stub(() => jsonResponse(ltBody([])));
    const outcome = await capabilityWith(fetchImpl).review(request({ language: null }));
    expect(outcome).toEqual({ status: 'unavailable', reason: 'unsupported_language' });
    expect(calls).toHaveLength(0);
  });

  it('maps BCP-47 variants to LanguageTool language tags', async () => {
    const { fetchImpl, calls } = stub(() => jsonResponse(ltBody([])));
    const capability = capabilityWith(fetchImpl);
    for (const language of ['en', 'en-GB', 'de-DE', 'fr']) {
      await capability.review(request({ language }));
    }
    expect(calls.map((call) => (call.init?.body as URLSearchParams)?.get('language'))).toEqual([
      'en-US',
      'en-GB',
      'de',
      'fr',
    ]);
  });

  it('maps a 400 language rejection to unsupported_language and counts it as an answer', async () => {
    const { fetchImpl, calls } = stub(() => jsonResponse({ error: 'language' }, 400));
    const capability = capabilityWith(fetchImpl, { baseUrl: 'http://127.0.0.1:9099' });
    const outcome = await capability.review(request({ language: 'zz-ZZ' }));
    expect(outcome).toEqual({ status: 'unavailable', reason: 'unsupported_language' });
    expect(capability.baseUrl).toBe('http://127.0.0.1:9099');
    expect(String(calls[0]?.input)).toBe('http://127.0.0.1:9099/v2/check');
    expect(capability.hasEngine()).toBe(true);
  });
});

describe('LanguageTool adapter — honest unavailability', () => {
  it('maps a network failure to engine_missing and flips hasEngine off', async () => {
    let attempt = 0;
    const { fetchImpl, calls } = stub(() => {
      attempt += 1;
      if (attempt === 1) return jsonResponse(ltBody([]));
      throw new TypeError('fetch failed');
    });
    const capability = capabilityWith(fetchImpl);
    expect(await capability.probe()).toBe(true);
    const outcome = await capability.review(request());
    expect(outcome).toEqual({ status: 'unavailable', reason: 'engine_missing' });
    expect(capability.hasEngine()).toBe(false);
    expect(calls).toHaveLength(2);
  });

  it('maps a timeout to timeout without changing health', async () => {
    const timeoutError = Object.assign(new Error('operation timed out'), { name: 'TimeoutError' });
    let attempt = 0;
    const { fetchImpl } = stub(() => {
      attempt += 1;
      if (attempt === 1) return jsonResponse(ltBody([]));
      throw timeoutError;
    });
    const capability = capabilityWith(fetchImpl);
    expect(await capability.probe()).toBe(true);
    const outcome = await capability.review(request());
    expect(outcome).toEqual({ status: 'unavailable', reason: 'timeout' });
    expect(capability.hasEngine()).toBe(true);
  });

  it('maps a 5xx response to incomplete_analysis while counting the answer', async () => {
    const { fetchImpl } = stub(() => jsonResponse({ error: 'boom' }, 500));
    const capability = capabilityWith(fetchImpl);
    const outcome = await capability.review(request());
    expect(outcome).toEqual({ status: 'unavailable', reason: 'incomplete_analysis' });
    expect(capability.hasEngine()).toBe(true);
  });

  it('maps unparseable and structurally broken bodies to incomplete_analysis', async () => {
    const notJson = stub(() => new Response('not json', { status: 200 }));
    expect(await capabilityWith(notJson.fetchImpl).review(request())).toEqual({
      status: 'unavailable',
      reason: 'incomplete_analysis',
    });

    const noMatchesArray = stub(() => jsonResponse({ software: {}, matches: 'nope' }));
    expect(await capabilityWith(noMatchesArray.fetchImpl).review(request())).toEqual({
      status: 'unavailable',
      reason: 'incomplete_analysis',
    });

    const nonObjectMatch = stub(() => jsonResponse(ltBody([null])));
    expect(await capabilityWith(nonObjectMatch.fetchImpl).review(request())).toEqual({
      status: 'unavailable',
      reason: 'incomplete_analysis',
    });
  });

  it('fails the run when the engine answer mis-maps (validator rejects — never silent)', async () => {
    // Out-of-range offsets: the adapter cites an empty quote rather than
    // slicing a wrong span, and the validator's rejection fails the run.
    const badOffsets = stub(() => jsonResponse(ltBody([ltMatch({ offset: 999 })])));
    expect(await capabilityWith(badOffsets.fetchImpl).review(request())).toEqual({
      status: 'unavailable',
      reason: 'incomplete_analysis',
    });

    // A match without any explanation cannot be grounded honestly.
    const noExplanation = stub(() => jsonResponse(ltBody([ltMatch({ message: '' })])));
    expect(await capabilityWith(noExplanation.fetchImpl).review(request())).toEqual({
      status: 'unavailable',
      reason: 'incomplete_analysis',
    });
  });

  it('reports no_supported_findings for an empty or fully filtered analysis', async () => {
    const empty = stub(() => jsonResponse(ltBody([])));
    expect(await capabilityWith(empty.fetchImpl).review(request())).toEqual({
      status: 'no_supported_findings',
    });

    // The only match overlaps an approved term — a clean run, not a failure.
    const filtered = stub(() => jsonResponse(ltBody([ltMatch({ offset: 0, length: 3 })])));
    expect(
      await capabilityWith(filtered.fetchImpl).review(request({ approvedTerms: ['The'] })),
    ).toEqual({ status: 'no_supported_findings' });
  });
});
