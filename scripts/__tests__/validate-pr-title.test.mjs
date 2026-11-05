import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const testDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(testDirectory, '../..');
const validatorPath = resolve(testDirectory, '../validate-pr-title.mjs');
const dependabot = 'dependabot[bot]';
const generatedTitle =
  'chore: bump the production-dependencies group across 1 directory with 4 updates';

function runValidator({
  title = generatedTitle,
  author = dependabot,
  actor = 'maintainer',
  titleChanged = false,
  events = [],
}) {
  const tempDirectory = mkdtempSync(join(tmpdir(), 'pr-title-validation-test-'));
  const eventsPath = join(tempDirectory, 'events.json');
  writeFileSync(eventsPath, JSON.stringify([events]), 'utf8');

  try {
    return spawnSync('node', [validatorPath, eventsPath], {
      cwd: repositoryRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        PR_TITLE: title,
        PR_AUTHOR: author,
        ACTOR: actor,
        TITLE_CHANGED: String(titleChanged),
      },
    });
  } finally {
    rmSync(tempDirectory, { recursive: true, force: true });
  }
}

function renameEvent({ id, actor, from, to, createdAt }) {
  return {
    id,
    event: 'renamed',
    actor: { login: actor },
    created_at: createdAt,
    rename: { from, to },
  };
}

describe('validate-pr-title.mjs', () => {
  it('continues rejecting a human-renamed Dependabot title after a body-only edit', () => {
    const titleRename = renameEvent({
      id: 101,
      actor: 'maintainer',
      from: 'chore: older generated title',
      to: generatedTitle,
      createdAt: '2026-09-27T10:00:00Z',
    });

    const renameResult = runValidator({ titleChanged: true });
    expect(renameResult.status).toBe(1);

    const bodyEditResult = runValidator({
      titleChanged: false,
      events: [titleRename],
    });
    expect(bodyEditResult.status).toBe(1);
  });

  it('keeps a Dependabot-authored title edit exempt', () => {
    const result = runValidator({ actor: dependabot, titleChanged: true });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('remains machine-authored');
  });

  it('keeps validating a human title when a later sync is performed by Dependabot', () => {
    const humanRename = renameEvent({
      id: 101,
      actor: 'maintainer',
      from: 'chore: older generated title',
      to: generatedTitle,
      createdAt: '2026-09-27T10:00:00Z',
    });
    const result = runValidator({
      actor: dependabot,
      titleChanged: false,
      events: [humanRename],
    });

    expect(result.status).toBe(1);
  });

  it('keeps an untouched bot-generated title exempt on a human body edit', () => {
    const result = runValidator({ titleChanged: false, events: [] });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('remains machine-authored');
  });

  it('uses the latest rename, preserving the exemption when the bot retitles the PR', () => {
    const result = runValidator({
      titleChanged: false,
      events: [
        renameEvent({
          id: 102,
          actor: dependabot,
          from: 'chore: human title',
          to: generatedTitle,
          createdAt: '2026-09-27T10:01:00Z',
        }),
        renameEvent({
          id: 101,
          actor: 'maintainer',
          from: 'chore: old title',
          to: 'chore: human title',
          createdAt: '2026-09-27T10:00:00Z',
        }),
      ],
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('remains machine-authored');
  });

  it('validates when the latest title history cannot be matched to the current title', () => {
    const result = runValidator({
      titleChanged: false,
      events: [
        renameEvent({
          id: 101,
          actor: dependabot,
          from: 'chore: previous title',
          to: 'chore: history does not match current title',
          createdAt: '2026-09-27T10:00:00Z',
        }),
      ],
    });

    expect(result.status).toBe(1);
  });
});
