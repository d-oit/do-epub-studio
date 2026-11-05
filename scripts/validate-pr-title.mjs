import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEPENDABOT_LOGIN = 'dependabot[bot]';
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '..');
const commitMessageHook = join(scriptDirectory, 'hooks/commit-msg');

function latestTitleRename(events) {
  let latest = null;

  for (const event of events) {
    if (event?.event !== 'renamed') continue;

    const eventTime = Date.parse(event.created_at);
    const latestTime = latest ? Date.parse(latest.created_at) : Number.NEGATIVE_INFINITY;
    const eventId = Number(event.id);
    const latestId = latest ? Number(latest.id) : Number.NEGATIVE_INFINITY;

    if (
      !latest ||
      !Number.isFinite(eventTime) ||
      !Number.isFinite(latestTime) ||
      eventTime > latestTime ||
      (eventTime === latestTime && eventId >= latestId)
    ) {
      latest = event;
    }
  }

  return latest;
}

function shouldValidateTitle({ author, actor, titleChanged, title, events }) {
  if (author !== DEPENDABOT_LOGIN) return true;

  // The edited event identifies who changed the title when the title changed.
  if (titleChanged) return actor !== DEPENDABOT_LOGIN;

  // Other PR events omit title authorship. Recover it from the latest rename
  // event, and fail closed if the event cannot be matched to the current title.
  const latestRename = latestTitleRename(events);
  if (!latestRename) return false;
  if (
    !Number.isFinite(Date.parse(latestRename.created_at)) ||
    !Number.isSafeInteger(Number(latestRename.id)) ||
    typeof latestRename.actor?.login !== 'string' ||
    typeof latestRename.rename?.to !== 'string'
  ) {
    return true;
  }
  if (latestRename.rename.to !== title) return true;
  return latestRename.actor.login !== DEPENDABOT_LOGIN;
}

function main() {
  const eventsPath = process.argv[2];
  if (!eventsPath) throw new Error('Expected the issue-event JSON file path.');

  const envKeys = ['PR_TITLE', 'PR_AUTHOR', 'ACTOR', 'TITLE_CHANGED'];
  for (const key of envKeys) {
    if (process.env[key] === undefined)
      throw new Error(`Missing required environment variable: ${key}`);
  }

  const eventPages = JSON.parse(readFileSync(eventsPath, 'utf8'));
  if (!Array.isArray(eventPages) || eventPages.some((page) => !Array.isArray(page))) {
    throw new Error('Expected a paginated array of GitHub issue events.');
  }

  const title = process.env.PR_TITLE;
  const validate = shouldValidateTitle({
    author: process.env.PR_AUTHOR,
    actor: process.env.ACTOR,
    titleChanged: process.env.TITLE_CHANGED === 'true',
    title,
    events: eventPages.flat(),
  });

  if (!validate) {
    console.log('Dependabot title remains machine-authored; skipped.');
    return 0;
  }

  const tempDirectory = mkdtempSync(join(tmpdir(), 'pr-title-validation-'));
  try {
    const titlePath = join(tempDirectory, 'title.txt');
    writeFileSync(titlePath, `${title}\n`, 'utf8');
    const result = spawnSync('bash', [commitMessageHook, '--subject-only', titlePath], {
      cwd: repositoryRoot,
      encoding: 'utf8',
    });

    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.error) throw result.error;

    if (result.status === 0) {
      console.log('PR title validated against scripts/hooks/commit-msg.');
    }
    return result.status ?? 1;
  } finally {
    rmSync(tempDirectory, { recursive: true, force: true });
  }
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
