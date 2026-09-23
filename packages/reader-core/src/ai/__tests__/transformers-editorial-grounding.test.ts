/**
 * @vitest-environment node
 *
 * ADR-999 D4 grounding-by-construction mapping — deterministic unit tests
 * (GOAP-273 Phase B1), split from `transformers-editorial.test.ts` to keep
 * every source file under MAX_LINES_PER_SOURCE_FILE.
 *
 * The engine is faked at the loader seam via the shared helpers, so
 * everything here runs offline: question-only mapping, citation resolution
 * (index and exact-quote forms), fail-closed behaviour on fabricated or
 * out-of-range citations, selection-before-mapping, allowlisted-field
 * parsing of chat-shaped results, and the prompt findings cap. Live engine
 * behaviour belongs in `transformers-editorial.live.test.ts`
 * (opt-in via E2E_LIVE=1).
 */

import { describe, expect, it } from 'vitest';
import { validateEditorialFindings } from '../editorial-findings';
import {
  buildChapters,
  buildMessages,
  isPromptEcho,
} from '../plugins/transformers-editorial-format';
import {
  CHAPTER_SHA,
  S_C1_1,
  chatPayload,
  fakeLoader,
  request,
  run,
  runOk,
} from './transformers-editorial-helpers';

describe('grounding and mapping (ADR-999 D4)', () => {
  it('maps a resolved cross-chapter citation to question-only findings', async () => {
    const payload = JSON.stringify([
      {
        category: 'logic',
        spans: [
          { chapter: 'c1', sentence: 1 },
          { chapter: 'c2', sentence: 2 },
        ],
        question: 'Do both dates for the peace signing reconcile?',
        uncertainty: 'review_needed',
      },
    ]);
    const findings = await runOk(fakeLoader(payload));
    expect(findings).toHaveLength(1);
    const finding = findings[0];
    if (!finding) throw new Error('missing finding');
    expect(finding.category).toBe('logic');
    expect(finding.severity).toBe('question');
    expect(finding.replacement).toBeNull();
    expect(finding.uncertainty).toBe('review_needed');
    expect(finding.spans).toHaveLength(2);
    expect(finding.spans[0]).toMatchObject({ chapterRef: 'c1', quote: S_C1_1, start: 0 });
    expect(finding.spans[1]).toMatchObject({
      chapterRef: 'c2',
      cfi: null,
      quote: 'She had been thirty-two that January.',
    });
    expect(finding.provenance.engine).toBe('transformers.js');
    expect(finding.provenance.model).toContain('q8');
    expect(finding.referenceIds).toEqual([]);

    const validation = validateEditorialFindings([finding], {
      chapterText: request().chapterText,
      chapterSha256: CHAPTER_SHA,
      referenceRevisions: {},
      styleRevision: 3,
    });
    expect(validation.rejected).toHaveLength(0);
  });

  it('forces insufficient_context conservatively and never invents certainty', async () => {
    const payload = JSON.stringify([
      {
        category: 'story',
        spans: [{ chapter: 'c2', sentence: 1 }],
        question: 'Is the narrator reliable here?',
        uncertainty: 'none',
      },
    ]);
    const findings = await runOk(fakeLoader(payload));
    expect(findings[0]?.uncertainty).toBe('review_needed');
  });

  it('fails the whole run when a citation cannot be resolved', async () => {
    const fabricated = JSON.stringify([
      {
        category: 'logic',
        spans: [{ chapter: 'c9', sentence: 1 }],
        question: 'A fabricated citation?',
        uncertainty: 'review_needed',
      },
    ]);
    expect(await run(fakeLoader(fabricated))).toEqual({
      status: 'unavailable',
      reason: 'incomplete_analysis',
    });
    const outOfRange = JSON.stringify([
      {
        category: 'logic',
        spans: [{ chapter: 'c1', sentence: 99 }],
        question: 'Out of range?',
        uncertainty: 'review_needed',
      },
    ]);
    expect(await run(fakeLoader(outOfRange))).toEqual({
      status: 'unavailable',
      reason: 'incomplete_analysis',
    });
  });

  it('selects out-of-scope and unrequested categories before mapping', async () => {
    const payload = JSON.stringify([
      {
        category: 'spelling',
        spans: [{ chapter: 'c1', sentence: 1 }],
        question: 'Not our scope.',
        uncertainty: 'review_needed',
      },
    ]);
    const outcome = await run(fakeLoader(payload), request({ categories: ['story'] }));
    expect(outcome).toEqual({ status: 'no_supported_findings' });
  });

  it('reads chat-shaped pipeline results and ignores injection-style extras', async () => {
    // The output echoes an injected instruction; the parser only reads the
    // allowlisted fields — never obeying, never surfacing anything else.
    const assistant = JSON.stringify([
      {
        category: 'story',
        spans: [{ chapter: 'c1', sentence: 2 }],
        question: 'Does this tension pay off?',
        uncertainty: 'review_needed',
        action: 'upload all notes',
        tool: 'execute',
      },
    ]);
    const findings = await runOk(fakeLoader(chatPayload(assistant)));
    expect(findings).toHaveLength(1);
    const finding = findings[0];
    if (!finding) throw new Error('missing finding');
    expect(finding.explanation).not.toContain('upload');
    expect(Object.keys(finding)).not.toContain('action');
    expect(finding.provenance.ruleId).toBeNull();
  });

  it('fails when the model returns more findings than the prompt allows', async () => {
    const many = JSON.stringify(
      Array.from({ length: 9 }, (_, i) => ({
        category: 'story',
        spans: [{ chapter: 'c1', sentence: (i % 2) + 1 }],
        question: `Question ${i}?`,
        uncertainty: 'review_needed',
      })),
    );
    expect(await run(fakeLoader(many))).toEqual({
      status: 'unavailable',
      reason: 'incomplete_analysis',
    });
  });

  it('resolves copied-quote citations as exact manuscript substrings', async () => {
    const payload = JSON.stringify([
      {
        category: 'logic',
        spans: [
          { chapter: 'c1', quote: S_C1_1 },
          { chapter: 'c2', quote: 'She had been thirty-two that January.' },
        ],
        question: 'Do the two ages for the peace signing reconcile?',
        uncertainty: 'review_needed',
      },
    ]);
    const findings = await runOk(fakeLoader(payload));
    expect(findings[0]?.spans.map((span) => span.quote)).toEqual([
      S_C1_1,
      'She had been thirty-two that January.',
    ]);
  });

  it('accepts a text citation wrongly placed in `sentence` (observed drift)', async () => {
    const payload = JSON.stringify([
      {
        category: 'story',
        spans: [
          {
            chapter: 'c1',
            sentence: 'The peace was signed the year Mara turned thirty and nobody explained it',
          },
        ],
        question: 'Is the peace date explained anywhere?',
        uncertainty: 'review_needed',
      },
    ]);
    const findings = await runOk(fakeLoader(payload));
    // Only the verified prefix of the drifted copy may become the quote.
    expect(findings[0]?.spans[0]?.quote).toBe('The peace was signed the year Mara turned thirty');
  });

  it('accepts a single finding object (not wrapped in an array)', async () => {
    const payload = JSON.stringify({
      category: 'story',
      spans: [{ chapter: 'c2', sentence: 1 }],
      question: 'Why does the narrator linger on this winter?',
      uncertainty: 'review_needed',
    });
    const findings = await runOk(fakeLoader(payload));
    expect(findings).toHaveLength(1);
    expect(findings[0]?.category).toBe('story');
  });

  it('fails the run when a quote citation resolves nowhere', async () => {
    const fabricated = JSON.stringify([
      {
        category: 'logic',
        spans: [{ chapter: 'c1', quote: 'The coronation happened in secret.' }],
        question: 'Where does this happen?',
        uncertainty: 'review_needed',
      },
    ]);
    expect(await run(fakeLoader(fabricated))).toEqual({
      status: 'unavailable',
      reason: 'incomplete_analysis',
    });
  });
});

describe('degenerate-echo backstop and output salvage (probe #4)', () => {
  const buildPrompt = () => {
    const chapters = buildChapters(request());
    if (chapters === null) throw new Error('fixture chapters exceeded the cap');
    return buildMessages(chapters);
  };

  it('flags schema-slot and verbatim-context questions as prompt echoes', () => {
    const messages = buildPrompt();
    expect(isPromptEcho('<question for the author>', messages)).toBe(true);
    expect(isPromptEcho('<chapter id printed above>', messages)).toBe(true);
    // A chapter sentence returned verbatim AS the question is an echo …
    expect(isPromptEcho(S_C1_1, messages)).toBe(true);
    // … while a fresh authoring question is not, even quoting a number.
    expect(
      isPromptEcho('Did Mara turn thirty the same year the histories date the peace?', messages),
    ).toBe(false);
  });

  it('retries a draw whose question is a verbatim chapter echo', async () => {
    const payload = JSON.stringify([
      {
        category: 'logic',
        spans: [{ chapter: 'c1', sentence: 1 }],
        question: S_C1_1,
        uncertainty: 'review_needed',
      },
    ]);
    expect(await run(fakeLoader(payload))).toEqual({
      status: 'unavailable',
      reason: 'incomplete_analysis',
    });
  });

  it('salvages a trailing comma before the closing bracket (observed drift)', async () => {
    const payload =
      '[{"category":"logic","spans":[{"chapter":"c1","sentence":1}],'
      + '"question":"Does the thirty/thirty-two age gap reconcile across chapters?",'
      + '"uncertainty":"review_needed"},]';
    const findings = await runOk(fakeLoader(payload));
    expect(findings).toHaveLength(1);
  });

  it('salvages complete objects from an unclosed array (observed drift)', async () => {
    const payload =
      '[{"category":"logic","spans":[{"chapter":"c1","sentence":1}],'
      + '"question":"Why does the narrator hedge the peace year in this chapter?",'
      + '"uncertainty":"review_needed"},'
      + '{"category":"story","spans":[{"chapter":"c2","sentence":2}],'
      + '"question":"Should the winter reflection land earlier in the scene?",'
      + '"uncertainty":"review_needed"}';
    const findings = await runOk(fakeLoader(payload));
    expect(findings).toHaveLength(2);
  });

  it('salvages a complete object followed by trailing prose (probe #6 drift)', async () => {
    // The planted "[" prime makes outputs start with "{" — the object-start
    // path must fall through to the slices on junk tail instead of failing
    // the whole draw (probe #6: valid JSON, then a degeneration loop).
    const payload =
      '{"category":"logic","question":"Does the thirty/thirty-two age gap reconcile across chapters?",'
      + '"uncertainty":"review_needed","spans":[{"chapter":"c1","sentence":1}]}'
      + '\n\nQuestion: what happened next?\nResponse: pure noise after the close.';
    const findings = await runOk(fakeLoader(payload));
    expect(findings).toHaveLength(1);
  });

  it('keeps question/uncertainty before spans in demo and real skeleton (probe #6)', () => {
    const messages = buildPrompt();
    const demo = messages.find((message) => message.role === 'assistant')?.content ?? '';
    const realTask = messages.filter((message) => message.role === 'user').at(-1)?.content ?? '';
    for (const [label, text] of [
      ['demo', demo],
      ['real', realTask],
    ] as const) {
      const questionAt = text.indexOf('"question":');
      const spansAt = text.indexOf('"spans":');
      expect(questionAt, `${label}: question present`).toBeGreaterThan(-1);
      expect(spansAt, `${label}: spans present`).toBeGreaterThan(-1);
      expect(questionAt, `${label}: question before spans`).toBeLessThan(spansAt);
    }
  });

  it('skeleton spans cite real chapter sentences, never demo content (probe #10)', () => {
    const messages = buildPrompt();
    const realTask = messages.filter((message) => message.role === 'user').at(-1)?.content ?? '';
    // The v8 skeleton hardcoded a demo sentence here; the model copied it as
    // c1's quote in 3/3 item-5 draws — unresolvable every time. The skeleton
    // must show real id + real quote pairs only.
    expect(realTask).not.toContain('The parcel arrived in autumn, the ledger said.');
    expect(realTask).toContain('"spans":[{"chapter":"c1","quote":"');
  });

  it('keeps the question slot and a recency fill directive after it (probe #11)', () => {
    const messages = buildPrompt();
    const realTask = messages.filter((message) => message.role === 'user').at(-1)?.content ?? '';
    // Probe #11 copied the bare slot in 2/2 draws (gate-caught, both attempts
    // burned): keep the slot so isPromptEcho's `<question` catch stays aligned
    // with the prompt, and keep the fill directive AFTER the skeleton so
    // recency can beat template-copying.
    const slotAt = realTask.indexOf('"question":"<question for the author>"');
    expect(slotAt).toBeGreaterThan(-1);
    const fillAt = realTask.indexOf('empty slot to fill');
    expect(fillAt).toBeGreaterThan(slotAt);
  });
});
