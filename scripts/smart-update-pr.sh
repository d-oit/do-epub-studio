#!/usr/bin/env bash
set -Eeuo pipefail

: "${REPO:?REPO is required}"
: "${PR_NUMBER:?PR_NUMBER is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"

tmp_root="$(mktemp -d)"
trap 'rm -rf "$tmp_root"' EXIT

note() { gh pr comment "$PR_NUMBER" --repo "$REPO" --body "$1" >/dev/null; }

pr_json="$(gh pr view "$PR_NUMBER" --repo "$REPO" \
  --json number,title,baseRefName,headRefName,headRepositoryOwner,headRepository,isCrossRepository,mergeable,url)"
base_ref="$(jq -r '.baseRefName' <<<"$pr_json")"
head_ref="$(jq -r '.headRefName' <<<"$pr_json")"
head_owner="$(jq -r '.headRepositoryOwner.login' <<<"$pr_json")"
head_repo="$(jq -r '.headRepository.name' <<<"$pr_json")"
mergeable="$(jq -r '.mergeable' <<<"$pr_json")"
is_cross_repo="$(jq -r '.isCrossRepository' <<<"$pr_json")"
pr_url="$(jq -r '.url' <<<"$pr_json")"

workdir="$tmp_root/repo"
git clone "https://x-access-token:${GH_TOKEN}@github.com/${REPO}.git" "$workdir" >/dev/null 2>&1
cd "$workdir"

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

git remote add head "https://x-access-token:${GH_TOKEN}@github.com/${head_owner}/${head_repo}.git" >/dev/null 2>&1 || true
git fetch origin "$base_ref" --depth=200
git fetch head "$head_ref" --depth=200
git checkout -B "pr-${PR_NUMBER}-head" "FETCH_HEAD"

# Native update path for clean PRs
if [[ "$mergeable" == "MERGEABLE" ]]; then
  if gh api -X PUT \
    -H "Accept: application/vnd.github+json" \
    "/repos/${REPO}/pulls/${PR_NUMBER}/update-branch" >/dev/null 2>&1; then
    note "Smart update: used native update-branch (PR was cleanly mergeable)."
    exit 0
  fi
fi

# Smart resolve path
tmp_branch="smart-update/pr-${PR_NUMBER}"
git checkout -B "$tmp_branch" "head/${head_ref}" 2>/dev/null || git checkout -B "$tmp_branch"

set +e
git merge --no-ff --no-commit "origin/${base_ref}" >/dev/null 2>&1
merge_status=$?
set -e

risk="low"
reason=""

if [[ $merge_status -ne 0 ]]; then
  conflicted_files="$(git diff --name-only --diff-filter=U || true)"
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    case "$f" in
      *.lock|package-lock.json|pnpm-lock.yaml|yarn.lock|Cargo.lock)
        git checkout --theirs -- "$f" || true ;;
      dist/*|build/*|coverage/*|*.snap)
        git checkout --ours -- "$f" || true ;;
      .github/workflows/*|db/migrations/*|migrations/*|auth/*|security/*)
        risk="high" ;;
      *) [[ "$risk" == "low" ]] && risk="medium" ;;
    esac
  done <<< "$conflicted_files"

  unresolved="$(git diff --name-only --diff-filter=U || true)"
  if [[ -n "$unresolved" ]]; then
    risk="high"
    reason="Unresolved semantic conflicts remain: $unresolved"
  else
    reason="Resolved heuristically; validation required."
  fi
fi

if [[ "$risk" == "high" ]]; then
  note "Smart update blocked for PR #${PR_NUMBER}. Risk=high. Reason: ${reason}. Manual review required."
  exit 1
fi

# Targeted test execution
changed_files="$(git diff --name-only --cached || true)"
run_js=false; run_rust=false; run_python=false; run_all=false

while IFS= read -r f; do
  case "$f" in
    package.json|pnpm-lock.yaml|yarn.lock|*.ts|*.js) run_js=true ;;
    Cargo.toml|Cargo.lock|*.rs) run_rust=true ;;
    pyproject.toml|requirements*.txt|*.py) run_python=true ;;
    .github/workflows/*|Makefile|Dockerfile*|compose*.yml) run_all=true ;;
  esac
done <<< "$changed_files"

[[ "$run_js" == "true" ]] && command -v pnpm >/dev/null 2>&1 && pnpm install --frozen-lockfile && pnpm test
[[ "$run_rust" == "true" ]] && [[ -f Cargo.toml ]] && cargo test
[[ "$run_python" == "true" ]] && command -v pytest >/dev/null 2>&1 && pytest
[[ "$run_all" == "true" ]] && [[ -x ./scripts/quality_gate.sh ]] && ./scripts/quality_gate.sh

if ! git diff --cached --quiet || ! git diff --quiet; then
  if [[ "$is_cross_repo" == "true" ]]; then
    note "Smart update: local resolution successful for PR #${PR_NUMBER}, but cannot push to fork automatically. Manual resolution recommended."
    exit 0
  fi
  git add -A
  git commit -m "chore(pr): smart update branch for #${PR_NUMBER}"
  git push head "HEAD:${head_ref}"
  note "Smart update succeeded for PR #${PR_NUMBER}. Risk=${risk}. Reason: ${reason}"
else
  note "Smart update: no changes to push for PR #${PR_NUMBER}."
fi
