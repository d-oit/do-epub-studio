import { afterEach, describe, expect, it } from 'vitest';
import { Harness } from './model/harness';
import { SchemaEraModel, mergeSemantics, tombstonePrecedes } from './model/reference-model';
import { getPendingConflicts, ConflictType } from './conflict-resolution';
import {
  acceptRemoteProgressFromConflict,
  resendProgressFromConflict,
} from './progress-conflict-actions';

const BOOK = 'book-1';

let h = new Harness();

afterEach(() => {
  h.finishScenario();
});

async function freshHarness(): Promise<Harness> {
  h = new Harness();
  await h.resetScenario();
  return h;
}

describe('merge semantics (reference model)', () => {
  it('concurrent semantic field changes require explicit conflict', () => {
    const base = { body: 'a', quote: 'q', anchor: 'x' };
    const local = { body: 'b', quote: 'q', anchor: 'x' };
    const remote = { body: 'c', quote: 'q', anchor: 'x' };
    const outcome = mergeSemantics(base, local, remote);
    expect(outcome.autoMerge).toBe(false);
    expect(outcome.reason).toBe('semantic_conflict');
  });

  it('single-side change auto-merges from the changed side', () => {
    const base = { body: 'a' };
    const local = { body: 'a' };
    const remote = { body: 'd' };
    const outcome = mergeSemantics(base, local, remote);
    expect(outcome.autoMerge).toBe(true);
    expect(outcome.winner).toBe('remote');
  });
  it('disjoint edits auto-merge without timestamp LWW', () => {
    const base = { body: 'a', label: 'l' };
    const local = { body: 'local', label: 'l' };
    const remote = { body: 'a', label: 'remote' };
    const outcome = mergeSemantics(base, local, remote);
    expect(outcome.autoMerge).toBe(true);
    expect(outcome.reason).toBe('cosmetic_lww');
  });
});

describe('tombstone precedence (reference model)', () => {
  it('deleted comment defeats a stale create replay', () => {
    expect(tombstonePrecedes(true, true)).toBe(true);
    expect(tombstonePrecedes(false, true)).toBe(false);
    expect(tombstonePrecedes(true, false)).toBe(false);
  });
});

describe('schema era migration (reference model)', () => {
  it('migrating legacy entities to the revisioned era preserves identity and content', () => {
    const model = new SchemaEraModel();
    model.addLegacyEntity({
      serverId: 'hl-1',
      kind: 'highlight',
      fields: { body: 'note', quote: 'q', anchor: 'x' },
    });
    model.addLegacyEntity({ serverId: 'cm-1', kind: 'comment', fields: { body: 'c' } });
    model.migrateToRevisioned();
    expect(model.assertMigrationPreserved(2)).toEqual([]);
    const created = model.createRevised('m-1', {
      serverId: 'hl-2',
      kind: 'highlight',
      fields: { body: 'n' },
    });
    expect(created.inserted).toBe(true);
    const replay = model.createRevised('m-1', {
      serverId: 'hl-3',
      kind: 'highlight',
      fields: { body: 'n' },
    });
    expect(replay.inserted).toBe(false);
    expect(replay.row.serverId).toBe('hl-2');
  });
});

describe('idempotency: duplicate delivery is exactly-once', () => {
  it('a create whose response is lost after commit produces one server row', async () => {
    await freshHarness();
    const mid = await h.createAnnotation('highlight', {
      cfi: 'epubcfi(/6/1)',
      text: 'dup',
      chapter: 'c1.xhtml',
      color: '#ffff00',
    });
    h.injectDirective({ kind: 'lostAfterCommit', path: '/highlights', times: 1 });
    expect(await h.quiesce()).toEqual([]);

    const snap = h.transport.server.snapshot();
    const rows = snap.highlights.filter((r) => r.mutationId === mid);
    expect(rows).toHaveLength(1);

    const highlightsPosts = h.requests.filter(
      (r) => r.source === 'client' && r.method === 'POST' && r.path.includes('/highlights'),
    );
    expect(highlightsPosts).toHaveLength(2);
    expect(highlightsPosts[0]?.droppedResponse).toBe(true);
    expect(highlightsPosts[1]?.replay).toBe(true);

    const replay = h.transport.server.applyRequest({
      method: 'POST',
      path: '/api/books/book-1/highlights',
      body: {
        mutationId: mid,
        locator: { cfi: 'epubcfi(/6/1)', selectedText: 'dup', chapterRef: 'c1.xhtml' },
        color: '#ffff00',
      },
    });
    expect(replay.status).toBe(200);
    expect(replay.replay).toBe(true);
    expect(h.transport.server.snapshot().highlights.length).toBe(1);
  });

  it('a create whose response times out after commit still settles exactly once', async () => {
    await freshHarness();
    const mid = await h.createAnnotation('comment', {
      cfi: 'epubcfi(/6/1)',
      text: 'sel',
      body: 'timeout-comment',
    });
    h.injectDirective({ kind: 'timeoutAfterCommit', path: '/comments', times: 1 });
    expect(await h.quiesce()).toEqual([]);
    const rows = h.transport.server.snapshot().comments.filter((r) => r.mutationId === mid);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe('open');
  });
});

describe('progress conflict explicitness', () => {
  it(
    'never applies blind LWW; records an explicit conflict and honors manual choice',
    async () => {
      await freshHarness();
      await h.updateProgress('epubcfi(/6/1)', 40);
      expect(await h.quiesce()).toEqual([]);
      expect(h.transport.server.snapshot().progress?.revision).toBe(1);

      let injected = false;
      h.transport.server.beforeApply = () => {
        const current = h.transport.server.snapshot().progress;
        if (!injected && current?.revision === 1) {
          injected = true;
          h.transport.server.applyRemote({
            kind: 'putProgress',
            body: {
              mutationId: 'remote-bump',
              locator: { cfi: 'remote-cfi' },
              progressPercent: 90,
              baseRevision: 1,
            },
          });
        }
      };
      await h.updateProgress('epubcfi(/8/2)', 60);
      expect(await h.quiesce()).toEqual([]);

      const conflicts = getPendingConflicts(BOOK).filter(
        (c) => c.type === ConflictType.ProgressUpdate,
      );
      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts.some((c) => !c.resolved)).toBe(true);
      expect(h.transport.server.snapshot().progress?.progressPercent).toBe(90);
      expect(h.transport.server.snapshot().progress?.revision).toBe(2);

      const conflict = conflicts.find((c) => !c.resolved);
      if (!conflict) throw new Error('expected an unresolved progress conflict');
      await acceptRemoteProgressFromConflict(conflict);

      await resendProgressFromConflict(conflict);
      expect(await h.quiesce()).toEqual([]);
      expect(h.transport.server.snapshot().progress?.progressPercent).toBe(60);
      expect(h.transport.server.snapshot().progress?.revision).toBe(3);
    },
  );
});

describe('deletion tombstone beats stale create', () => {
  it('a deleted comment stays deleted across replay of its create mutation', async () => {
    await freshHarness();
    const mid = await h.createAnnotation('comment', {
      cfi: 'epubcfi(/6/1)',
      text: 'sel',
      body: 'tombstone',
    });
    expect(await h.quiesce()).toEqual([]);
    const row = h.transport.server.snapshot().comments.find((r) => r.mutationId === mid);
    if (!row) throw new Error('expected comment row from create mutation');

    h.remoteWrite({ kind: 'deleteComment', id: row.id });
    expect(
      h.transport.server.snapshot().comments.find((r) => r.id === row.id)?.status,
    ).toBe('deleted');

    const replay = h.transport.server.applyRequest({
      method: 'POST',
      path: '/api/books/book-1/comments',
      body: {
        mutationId: mid,
        locator: { cfi: 'epubcfi(/6/1)', selectedText: 'sel', chapterRef: 'c1.xhtml' },
        body: 'tombstone',
        visibility: 'shared',
      },
    });
    expect(replay.status).toBe(200);
    expect(replay.replay).toBe(true);
    expect(
      h.transport.server.snapshot().comments.find((r) => r.id === row.id)?.status,
    ).toBe('deleted');
  });
});

describe('session and offline fences', () => {
  it('logout parks the queue; re-login drains it', async () => {
    await freshHarness();
    const before = h.requests.length;
    await h.createAnnotation('highlight', { cfi: 'epubcfi(/6/1)', text: 'fence', chapter: '' });
    h.logout();
    await h.quiesce();
    expect(h.requests.length).toBe(before);

    h.login();
    expect(await h.quiesce()).toEqual([]);
    expect(h.transport.server.snapshot().highlights).toHaveLength(1);
  });

  it('offline queues writes without touching the server; online pushes them', async () => {
    await freshHarness();
    h.setOnline(false);
    await h.updateProgress('epubcfi(/6/1)', 50);
    await h.quiesce();
    expect(h.transport.server.snapshot().progress).toBeNull();

    h.setOnline(true);
    expect(await h.quiesce()).toEqual([]);
    expect(h.transport.server.snapshot().progress?.progressPercent).toBe(50);
  });
});

describe('legacy (pre-mutation-id) server behavior', () => {
  it('creates without mutation ids are not deduplicated; revisioned creates are', async () => {
    await freshHarness();
    const first = h.transport.server.applyRequest({
      method: 'POST',
      path: '/api/books/book-1/highlights',
      body: {
        locator: { cfi: 'epubcfi(/6/1)', selectedText: 's', chapterRef: 'c' },
        color: '#ffff00',
      },
    });
    const second = h.transport.server.applyRequest({
      method: 'POST',
      path: '/api/books/book-1/highlights',
      body: {
        locator: { cfi: 'epubcfi(/6/1)', selectedText: 's', chapterRef: 'c' },
        color: '#ffff00',
      },
    });
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(first.body.data).not.toEqual(second.body.data);

    const revised = h.transport.server.applyRequest({
      method: 'POST',
      path: '/api/books/book-1/highlights',
      body: {
        mutationId: 'm-revised',
        locator: { cfi: 'epubcfi(/6/1)', selectedText: 's', chapterRef: 'c' },
        color: '#ffff00',
      },
    });
    expect(revised.status).toBe(201);
    const replay = h.transport.server.applyRequest({
      method: 'POST',
      path: '/api/books/book-1/highlights',
      body: {
        mutationId: 'm-revised',
        locator: { cfi: 'epubcfi(/6/1)', selectedText: 's', chapterRef: 'c' },
        color: '#ffff00',
      },
    });
    expect(replay.status).toBe(200);
    expect(replay.replay).toBe(true);
    expect(replay.body.data).toEqual(revised.body.data);
  });
});
