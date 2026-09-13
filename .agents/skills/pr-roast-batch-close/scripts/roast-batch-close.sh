#!/usr/bin/env bash
# pr-roast-batch-close: batch-review open PRs, roast for impact, close zero-impact ones.
# All mutations (close/review) are dry-run by default; --execute is required for real gh calls.
set -euo pipefail

usage() {
  cat >&2 <<'EOF'
Usage: roast-batch-close.sh <command> [options]

Commands:
  collect   Build a JSON dossier of open PRs (candidates + excluded with reasons)
  close     Close a PR with a comment (dry-run unless --execute)
  merge     Merge approved PRs in dependency-safe order, each synced to latest main (dry-run unless --execute)

Run 'roast-batch-close.sh <command> --help' for command options.
EOF
}

usage_collect() {
  cat >&2 <<'EOF'
Usage: roast-batch-close.sh collect [-R OWNER/REPO] [--exclude-author LOGIN]...
                                    [--exclude-label NAME]... [--include-drafts]

Emits a JSON dossier: repo, generated_at, exclusions, candidates, excluded.
Default repo comes from 'gh repo view' (current directory's repository).
Default exclusion: drafts.
EOF
}

usage_close() {
  cat >&2 <<'EOF'
Usage: roast-batch-close.sh close [-R OWNER/REPO] --pr N --comment-file FILE [--execute]

Without --execute: prints the would-be 'gh pr close' command and exits 0.
FILE must exist and be non-empty.
EOF
}

usage_review() {
  cat >&2 <<'EOF'
Usage: roast-batch-close.sh review [-R OWNER/REPO] --pr N
                                   --decision approve|request-changes|comment
                                   --comment-file FILE [--execute]

Without --execute: prints the would-be 'gh pr review' command and exits 0.
FILE must exist and be non-empty.
EOF
}

usage_merge() {
  cat >&2 <<'EOF'
Usage: roast-batch-close.sh merge [-R OWNER/REPO] --pr N [--pr M ...]
                                  [--merge-method squash|rebase|merge]
                                  [--wait-ci] [--no-sync-main] [--execute]

Orders the given PRs (approved ones only — the caller decides which), then for
each in order: checks it out, merges origin/main into it ("latest branch"),
pushes, gates on CI, and merges. Dry-run by default prints the full sequence.

Ordering (deterministic): overlap-degree ascending (independent PRs first),
then changedFiles ascending, then createdAt ascending (older = base first).
After each merge main advances; the next PR re-syncs before its merge.

Refuses: drafts, PRs labeled bug/security/critical, PRs with merge conflicts.
Runs from a clean checkout of the target repo (needs git).
EOF
}

require_auth() {
  gh auth status >/dev/null 2>&1 || { echo "gh not authenticated" >&2; exit 1; }
}

default_repo() {
  gh repo view --json nameWithOwner -q .nameWithOwner
}

cmd_collect() {
  require_auth
  local repo="" include_drafts=false
  local authors=() labels=()
  while [ $# -gt 0 ]; do
    case "$1" in
      -R) [ $# -ge 2 ] || { usage_collect >&2; exit 2; }; repo="$2"; shift 2 ;;
      --exclude-author) [ $# -ge 2 ] || { usage_collect >&2; exit 2; }; authors+=("$2"); shift 2 ;;
      --exclude-label) [ $# -ge 2 ] || { usage_collect >&2; exit 2; }; labels+=("$2"); shift 2 ;;
      --include-drafts) include_drafts=true; shift ;;
      -h|--help) usage_collect; exit 0 ;;
      *) echo "Unknown option: $1" >&2; usage_collect >&2; exit 2 ;;
    esac
  done
  [ -n "$repo" ] || repo="$(default_repo)"

  local prs
  prs="$(gh pr list --state open -R "$repo" --limit 200 \
    --json number,title,author,createdAt,updatedAt,additions,deletions,changedFiles,baseRefName,headRefName,isDraft,mergeable,reviewDecision,labels,url)"

  local author_str label_str now
  author_str="$(IFS=','; printf '%s' "${authors[*]}")"
  label_str="$(IFS=','; printf '%s' "${labels[*]}")"
  now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

  jq \
    --arg repo "$repo" \
    --arg now "$now" \
    --arg authors_str "$author_str" \
    --arg labels_str "$label_str" \
    --argjson exclude_drafts "$( [ "$include_drafts" = true ] && echo false || echo true )" \
    '
    ($authors_str | if . == "" then [] else split(",") end) as $authors
    | ($labels_str | if . == "" then [] else split(",") end) as $labels
    | def age_of: (((now - (.createdAt | fromdateiso8601)) / 86400) | floor);
      def to_candidate: {
        number: .number,
        title: .title,
        author: .author.login,
        createdAt: .createdAt,
        age_days: age_of,
        additions: .additions,
        deletions: .deletions,
        changedFiles: .changedFiles,
        baseRefName: .baseRefName,
        headRefName: .headRefName,
        isDraft: .isDraft,
        mergeable: .mergeable,
        reviewDecision: .reviewDecision,
        labels: [ .labels[]?.name ],
        url: .url
      };
      def first_bad_label: ([ .labels[]?.name | select(. as $l | $labels | index($l) != null) ] | .[0]);
    [ .[] | . as $pr
      | ($pr | first_bad_label) as $bad_label
      | { pr: $pr,
          reason: (if ($exclude_drafts and ($pr.isDraft == true)) then "draft"
                   elif (($authors | index($pr.author.login)) != null) then "author:\($pr.author.login)"
                   elif ($bad_label != null) then "label:\($bad_label)"
                   else null end) } ]
    | { repo: $repo,
        generated_at: $now,
        exclusions: { exclude_drafts: $exclude_drafts, authors: $authors, labels: $labels },
        candidates: [ .[] | select(.reason == null) | .pr | to_candidate ],
        excluded: [ .[] | select(.reason != null) | { number: .pr.number, title: .pr.title, reason: .reason } ] }
    ' <<<"$prs"
}

cmd_close() {
  require_auth
  local repo="" pr="" comment_file="" execute=false
  while [ $# -gt 0 ]; do
    case "$1" in
      -R) [ $# -ge 2 ] || { usage_close >&2; exit 2; }; repo="$2"; shift 2 ;;
      --pr) [ $# -ge 2 ] || { usage_close >&2; exit 2; }; pr="$2"; shift 2 ;;
      --comment-file) [ $# -ge 2 ] || { usage_close >&2; exit 2; }; comment_file="$2"; shift 2 ;;
      --execute) execute=true; shift ;;
      -h|--help) usage_close; exit 0 ;;
      *) echo "Unknown option: $1" >&2; usage_close >&2; exit 2 ;;
    esac
  done
  [ -n "$repo" ] || repo="$(default_repo)"
  [[ "$pr" =~ ^[0-9]+$ ]] || { echo "--pr expects a PR number" >&2; usage_close >&2; exit 2; }
  if [ -z "$comment_file" ] || [ ! -f "$comment_file" ] || [ ! -s "$comment_file" ]; then
    echo "--comment-file must be an existing non-empty file" >&2
    usage_close >&2
    exit 2
  fi

  if [ "$execute" = false ]; then
    echo "gh pr close $pr -R $repo --comment \"\$(cat $comment_file)\""
    exit 0
  fi
  gh pr close "$pr" -R "$repo" --comment "$(cat "$comment_file")"
}

cmd_review() {
  require_auth
  local repo="" pr="" decision="" comment_file="" execute=false
  while [ $# -gt 0 ]; do
    case "$1" in
      -R) [ $# -ge 2 ] || { usage_review >&2; exit 2; }; repo="$2"; shift 2 ;;
      --pr) [ $# -ge 2 ] || { usage_review >&2; exit 2; }; pr="$2"; shift 2 ;;
      --decision) [ $# -ge 2 ] || { usage_review >&2; exit 2; }; decision="$2"; shift 2 ;;
      --comment-file) [ $# -ge 2 ] || { usage_review >&2; exit 2; }; comment_file="$2"; shift 2 ;;
      --execute) execute=true; shift ;;
      -h|--help) usage_review; exit 0 ;;
      *) echo "Unknown option: $1" >&2; usage_review >&2; exit 2 ;;
    esac
  done
  [ -n "$repo" ] || repo="$(default_repo)"
  [[ "$pr" =~ ^[0-9]+$ ]] || { echo "--pr expects a PR number" >&2; usage_review >&2; exit 2; }
  local decision_flag
  case "$decision" in
    approve) decision_flag="--approve" ;;
    request-changes) decision_flag="--request-changes" ;;
    comment) decision_flag="--comment" ;;
    *) echo "Unknown --decision: $decision (expected approve|request-changes|comment)" >&2; usage_review >&2; exit 2 ;;
  esac
  if [ -z "$comment_file" ] || [ ! -f "$comment_file" ] || [ ! -s "$comment_file" ]; then
    echo "--comment-file must be an existing non-empty file" >&2
    usage_review >&2
    exit 2
  fi

  if [ "$execute" = false ]; then
    echo "gh pr review $pr -R $repo $decision_flag --body-file $comment_file"
    exit 0
  fi
  gh pr review "$pr" -R "$repo" "$decision_flag" --body-file "$comment_file"
}

cmd_merge() {
  require_auth
  local repo="" method="squash" wait_ci=false sync_main=true execute=false
  local prs=()
  while [ $# -gt 0 ]; do
    case "$1" in
      -R) [ $# -ge 2 ] || { usage_merge >&2; exit 2; }; repo="$2"; shift 2 ;;
      --pr) [ $# -ge 2 ] || { usage_merge >&2; exit 2; }
        [[ "$2" =~ ^[0-9]+$ ]] || { echo "--pr expects a PR number, got: $2" >&2; usage_merge >&2; exit 2; }
        prs+=("$2"); shift 2 ;;
      --merge-method)
        [ $# -ge 2 ] || { usage_merge >&2; exit 2; }
        case "$2" in squash|rebase|merge) method="$2" ;; *) echo "Invalid --merge-method: $2 (expected squash|rebase|merge)" >&2; exit 2 ;; esac
        shift 2 ;;
      --wait-ci) wait_ci=true; shift ;;
      --no-sync-main) sync_main=false; shift ;;
      --execute) execute=true; shift ;;
      -h|--help) usage_merge; exit 0 ;;
      *) echo "Unknown option: $1" >&2; usage_merge >&2; exit 2 ;;
    esac
  done
  [ ${#prs[@]} -ge 1 ] || { echo "merge requires at least one --pr N" >&2; usage_merge >&2; exit 2; }
  [ -n "$repo" ] || repo="$(default_repo)"

  # Fetch per-PR metadata; reject unsafe PRs up front (safety gates).
  local -A meta=()
  local n bad=0
  for n in "${prs[@]}"; do
    local m
    m="$(gh pr view "$n" -R "$repo" --json number,title,isDraft,labels,mergeable,createdAt,headRefName,files)"
    local draft bad_label mergeable
    draft="$(jq -r '.isDraft' <<<"$m")"
    mergeable="$(jq -r '.mergeable' <<<"$m")"
    bad_label="$(jq -r '[.labels[].name] | map(select(. == "bug" or . == "security" or . == "critical")) | .[0] // empty' <<<"$m")"
    if [ "$draft" = "true" ]; then echo "REFUSED pr $n: draft" >&2; bad=1; fi
    if [ -n "$bad_label" ]; then echo "REFUSED pr $n: label $bad_label" >&2; bad=1; fi
    if [ "$mergeable" != "MERGEABLE" ]; then echo "REFUSED pr $n: mergeable=$mergeable" >&2; bad=1; fi
    meta[$n]="$m"
  done
  [ "$bad" -eq 0 ] || exit 2

  # Deterministic order: overlap-degree asc (independent first), changedFiles
  # asc (smaller blast radius first), createdAt asc (older = base first).
  # Because each merge advances main, every later PR re-syncs to the new main
  # before its own merge, which is the real conflict safety net.
  local order_json
  order_json="$(for n in "${prs[@]}"; do
    jq -c '{number, createdAt, nf: (.files | length), files: [.files[].path]}' <<<"${meta[$n]}"
  done | jq -c -s '
    . as $all
    | [ $all[] | . as $a
        | { n: $a.number, createdAt: $a.createdAt, nf: $a.nf,
            deg: ([ $all[]
                    | select(.number != $a.number)
                    | select(any($a.files[]; . as $f | (($a.files) | index($f)) != null)) ]
                  | length) } ]
    | sort_by(.deg, .nf, .createdAt)
    | map(.n)')"
  echo "$order_json" | jq -r '"MERGE ORDER: " + (map(tostring) | join(" -> "))'

  local prev_branch
  prev_branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo main)"
  local i=0 total=${#prs[@]}
  for n in $(jq -r '.[]' <<<"$order_json"); do
    i=$((i + 1))
    branch="$(jq -r '.headRefName' <<<"${meta[$n]}")"
    echo "--- PR $n (order $i/${total}, branch $branch) ---"
    if [ "$execute" = false ]; then
      echo "  gh pr checkout $n -R $repo"
      if [ "$sync_main" = true ]; then
        echo "  git fetch origin && git merge --no-edit origin/main && git push"
      fi
      if [ "$wait_ci" = true ]; then
        echo "  gh pr checks $n -R $repo --watch"
      else
        echo "  gh pr checks $n -R $repo   # abort if any FAIL"
      fi
      echo "  gh pr merge $n -R $repo --$method"
      echo "  git checkout $prev_branch"
      continue
    fi
    # --- execute path ---
    command git diff --quiet || { echo "ABORT pr $n: working tree not clean" >&2; exit 2; }
    gh pr checkout "$n" -R "$repo"
    if [ "$sync_main" = true ]; then
      git fetch origin
      git merge --no-edit origin/main || { echo "ABORT pr $n: merge with origin/main conflicted" >&2; exit 2; }
      git push
    fi
    if [ "$wait_ci" = true ]; then
      gh pr checks "$n" -R "$repo" --watch
    else
      local checks_out
      checks_out="$(gh pr checks "$n" -R "$repo" 2>/dev/null || true)"
      if printf '%s\n' "$checks_out" | awk -F'\t' '$2 == "fail" {f=1} END { exit f ? 0 : 1 }'; then
        echo "SKIP pr $n: CI has failures (use --wait-ci to watch instead)" >&2
        git checkout "$prev_branch"
        continue
      fi
    fi
    gh pr merge "$n" -R "$repo" "--$method"
    echo "MERGED pr $n"
    git checkout "$prev_branch"
  done
  [ "$execute" = false ] && echo "(dry-run: nothing executed; add --execute to run)"
  return 0
}

main() {
  if [ $# -lt 1 ]; then
    usage >&2
    exit 2
  fi
  case "$1" in
    collect) shift; cmd_collect "$@" ;;
    close) shift; cmd_close "$@" ;;
    review) shift; cmd_review "$@" ;;
    merge) shift; cmd_merge "$@" ;;
    *) echo "Unknown command: $1" >&2; usage >&2; exit 2 ;;
  esac
}

main "$@"
