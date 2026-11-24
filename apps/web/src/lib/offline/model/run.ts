/**
 * Seeded runner for the sync model suite. A run plans a deterministic op
 * sequence from a 32-bit seed (mulberry32), executes it against the real
 * client sync stack via the Harness, checks light invariants after every op,
 * performs deep encrypted-store audits at checkpoints, and reports violations
 * with a compact trace + replay command.
 */

import { Harness, ModelSuiteError, replayCommand } from './harness';
import { Rng } from './prng';
import type { FailureDirective, RemoteAction } from './types';

export interface RunOptions {
  steps: number;
  /** Number of mid-run deep audits (0 = only the final audit). */
  audits: number;
}

export interface RunOutcome {
  seed: number;
  violations: string[];
  trace: string[];
}

const CFI_POOL = [
  'epubcfi(/6/1)',
  'epubcfi(/6/4!/4/2/1:0)',
  'epubcfi(/8/2)',
  'epubcfi(/4/3!/2/1:0)',
];
const CHAPTER_POOL = ['c1.xhtml', 'c2.xhtml', ''];
const COLOR_POOL = ['#ffff00', '#ff0000', '#00a0ff'];
const PROGRESS_PATH = '/progress';

function cfi(rng: Rng): string {
  return rng.pick(CFI_POOL);
}

function percent(rng: Rng): number {
  return rng.int(1, 100);
}

function remoteMutationId(rng: Rng, seq: number): string {
  return `remote-${rng.int(1000, 9999)}-${seq}`;
}

function pickRemoteAction(h: Harness, rng: Rng, seq: number): RemoteAction | null {
  const snap = h.transport.server.snapshot();
  const highlights = snap.highlights;
  const comments = snap.comments.filter((c) => c.status !== 'deleted');
  const bookmarks = snap.bookmarks;
  const options: (() => RemoteAction | null)[] = [
    () => ({
      kind: 'createHighlight',
      body: {
        mutationId: remoteMutationId(rng, seq),
        locator: {
          chapterRef: rng.pick(CHAPTER_POOL),
          cfi: cfi(rng),
          selectedText: `remote-text-${seq}`,
        },
        color: rng.pick(COLOR_POOL),
      },
    }),
    () => {
      if (highlights.length === 0) return null;
      const row = highlights[rng.int(0, highlights.length - 1)];
      if (!row) return null;
      return { kind: 'editHighlight', id: row.id, body: { note: `remote-note-${seq}` } };
    },
    () => {
      if (highlights.length === 0) return null;
      const row = highlights[rng.int(0, highlights.length - 1)];
      if (!row) return null;
      return { kind: 'deleteHighlight', id: row.id };
    },
    () => ({
      kind: 'createComment',
      body: {
        mutationId: remoteMutationId(rng, seq),
        locator: {
          chapterRef: rng.pick(CHAPTER_POOL),
          cfi: cfi(rng),
          selectedText: 'remote-selection',
        },
        body: `remote-comment-${seq}`,
        visibility: 'shared',
      },
    }),
    () => {
      if (comments.length === 0) return null;
      const row = comments[rng.int(0, comments.length - 1)];
      if (!row) return null;
      return { kind: 'editComment', id: row.id, body: { body: `remote-edit-${seq}` } };
    },
    () => {
      if (comments.length === 0) return null;
      const row = comments[rng.int(0, comments.length - 1)];
      if (!row) return null;
      return { kind: 'deleteComment', id: row.id };
    },
    () => ({
      kind: 'createBookmark',
      body: {
        mutationId: remoteMutationId(rng, seq),
        locator: { cfi: cfi(rng) },
        label: `remote-bookmark-${seq}`,
      },
    }),
    () => {
      if (bookmarks.length === 0) return null;
      const row = bookmarks[rng.int(0, bookmarks.length - 1)];
      if (!row) return null;
      return { kind: 'deleteBookmark', id: row.id };
    },
    () => {
      const progress = snap.progress;
      if (!progress) return null;
      const stale = rng.chance(0.5);
      return {
        kind: 'putProgress',
        body: {
          mutationId: remoteMutationId(rng, seq),
          locator: { cfi: cfi(rng) },
          progressPercent: percent(rng),
          baseRevision: stale ? 0 : progress.revision,
        },
      };
    },
  ];
  for (let i = 0; i < 6; i++) {
    const action = rng.pick(options)();
    if (action) return action;
  }
  return null;
}

function pickDirective(rng: Rng): FailureDirective {
  const kindRoll = rng.next();
  const kind =
    kindRoll < 0.3
      ? 'lostAfterCommit'
      : kindRoll < 0.55
        ? 'transient5xx'
        : kindRoll < 0.8
          ? 'transientNetwork'
          : 'timeoutAfterCommit';
  const pathRoll = rng.next();
  const path =
    pathRoll < 0.4
      ? PROGRESS_PATH
      : pathRoll < 0.65
        ? '/highlights'
        : pathRoll < 0.9
          ? '/comments'
          : '/bookmarks';
  return { kind, path, times: rng.chance(0.3) ? 2 : 1 };
}

function fail(seed: number, step: number, violations: string[], h: Harness): never {
  const tail = h.trace.slice(-30).join('\n');
  const requests = h.requests
    .slice(-20)
    .map(
      (r) =>
        `  ${r.source} ${r.method} ${r.path} mid=${r.mutationId ? r.mutationId.slice(0, 8) : '-'} status=${r.status} committed=${r.committed} replay=${r.replay}${r.droppedResponse ? ' DROPPED' : ''}`,
    )
    .join('\n');
  const message = [
    `Sync model invariants violated at seed ${seed}, step ${step}:`,
    ...violations.map((v) => `  - ${v}`),
    '',
    'Trace (last 30 ops):',
    tail,
    '',
    'Recent requests:',
    requests,
    '',
    `Replay: ${replayCommand(seed)}`,
  ].join('\n');
  throw new ModelSuiteError(message);
}

export async function runSeed(seed: number, opts: RunOptions): Promise<RunOutcome> {
  const h = new Harness();
  await h.resetScenario();
  try {
    const rng = new Rng(seed);
    const auditSpacing =
      opts.audits > 0 ? Math.max(1, Math.floor(opts.steps / (opts.audits + 1))) : Infinity;
    let remoteSeq = 0;

    for (let step = 0; step < opts.steps; step++) {
      if (step > 0 && opts.audits > 0 && step % auditSpacing === 0) {
        const violations = await h.deepAudit();
        if (violations.length > 0) fail(seed, step, violations, h);
      }

      const roll = rng.next();
      const snapshot = h.transport.server.snapshot();
      const comments = snapshot.comments.filter((c) => c.status !== 'deleted');
      const canMutate = h.authed;

      if (roll < 0.13) {
        if (canMutate) {
          await h.createAnnotation('highlight', {
            cfi: cfi(rng),
            text: `text-${rng.int(0, 99)}`,
            chapter: rng.pick(CHAPTER_POOL),
            color: rng.pick(COLOR_POOL),
          });
        }
      } else if (roll < 0.26) {
        if (canMutate) {
          await h.createAnnotation('comment', {
            cfi: cfi(rng),
            text: 'selection',
            chapter: rng.pick(CHAPTER_POOL),
            body: `comment-${rng.int(0, 99)}`,
          });
        }
      } else if (roll < 0.34) {
        if (canMutate) {
          await h.createAnnotation('bookmark', {
            cfi: cfi(rng),
            text: `bookmark-${rng.int(0, 99)}`,
          });
        }
      } else if (roll < 0.4) {
        if (canMutate && comments.length > 0) {
          const row = rng.pick(comments);
          await h.resolveComment(row.id, row.status === 'resolved' ? 'open' : 'resolved');
        }
      } else if (roll < 0.58) {
        if (canMutate) {
          await h.updateProgress(cfi(rng), percent(rng));
        }
      } else if (roll < 0.62) {
        if (canMutate) {
          await h.updateProgress(cfi(rng), percent(rng), h.pendingProgressMutationId ?? undefined);
        }
      } else if (roll < 0.66) {
        h.logout();
      } else if (roll < 0.7) {
        h.login();
      } else if (roll < 0.74) {
        h.setOnline(false);
      } else if (roll < 0.78) {
        h.setOnline(true);
      } else if (roll < 0.92) {
        remoteSeq += 1;
        const action = pickRemoteAction(h, rng, remoteSeq);
        if (action) {
          h.remoteWrite(action);
        } else if (canMutate) {
          await h.updateProgress(cfi(rng), percent(rng));
        }
      } else if (roll < 0.97) {
        h.injectDirective(pickDirective(rng));
      } else {
        const violations = await h.deepAudit();
        if (violations.length > 0) fail(seed, step, violations, h);
        continue;
      }

      const light = h.checkLightInvariants();
      if (light.length > 0) fail(seed, step, light, h);

      const probeViolations = await h.quiesce();
      if (probeViolations.length > 0) fail(seed, step, probeViolations, h);
    }

    const finalViolations = await h.deepAudit();
    if (finalViolations.length > 0) fail(seed, opts.steps, finalViolations, h);

    return { seed, violations: [], trace: h.trace };
  } finally {
    h.finishScenario();
  }
}

export const QUICK_STEPS = 8;

export async function runQuickSweep(seeds: number[]): Promise<void> {
  for (const seed of seeds) {
    await runSeed(seed, { steps: QUICK_STEPS, audits: 0 });
  }
}

export async function runDeepSeed(seed: number): Promise<void> {
  await runSeed(seed, { steps: 80, audits: 8 });
}
