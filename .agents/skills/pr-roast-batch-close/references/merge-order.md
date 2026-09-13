# Merge Order & Latest-Branch Rules

Phase 5 merges only APPROVED PRs (score >= 6) whose report recommendations are
all addressed. One PR with an open recommendation = that PR does not merge.

## Merge order (deterministic)

Sort key, ascending:

1. **Overlap degree** — number of other selected PRs sharing >= 1 changed file.
   Degree 0 (independent) PRs merge first: they are base-stable, nothing can
   conflict with them.
2. **changedFiles** ascending — smaller blast radius first among overlapping.
3. **createdAt** ascending — the older PR is the likely base of the newer one.

The sort alone is a heuristic; the real safety net is that **every** PR is
synced to the latest main immediately before its own merge (below), so the
order only decides who goes first, never whether a branch is current.

## Latest-branch guarantee

Before each merge, for EVERY PR (no exceptions):

```
gh pr checkout N -R <repo>
git fetch origin
git merge --no-edit origin/main    # pulls in every previously merged PR
git push
```

Because merges are sequential and main advances after each one, PR k always
merges with main containing PR 1..k-1. Skip this only with `--no-sync-main`
(not recommended).

## Per-PR sequence (`--execute`)

1. `git diff --quiet` — refuse on dirty working tree (exit 2)
2. `gh pr checkout N`
3. latest-branch sync (above)
4. CI gate: `gh pr checks N --watch` (with `--wait-ci`), else one-shot check
   that aborts the PR if any check state is `fail`
5. `gh pr merge N --<method>` (default `--squash`)
6. `git checkout <previous-branch>`

Any failure (merge conflict with main, red CI) aborts that PR's merge; earlier
merges stay merged — main is never force-pushed or reset.

## Hard refusals

- draft PR
- PR labeled `bug`, `security`, or `critical`
- `mergeable != MERGEABLE` (conflicts reported by GitHub)
- dirty working tree
- any report recommendation still open on that PR
