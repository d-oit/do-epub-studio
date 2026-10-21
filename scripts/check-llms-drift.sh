#!/usr/bin/env bash
# check-llms-drift.sh — verify that the LLM context files still match the repository.
#
# GOAP-276 Phase 2: "llms.txt generator + drift check".
#
# `llms.txt` and `llms-full.txt` are hand-written context documents, not
# generated artifacts, so they cannot be regenerated mechanically without
# losing their prose. What can be verified mechanically is the part that
# goes stale silently: every path they name, and every command they tell an
# agent to run. A renamed directory or a removed script turns the injected
# session context into a list of lies, and no test would notice.
#
# The check therefore verifies:
#   1. every repository path mentioned in either file exists
#   2. every `pnpm <script>` / `./scripts/<file>.sh` command in the fenced
#      bash blocks is a script the workspace actually defines
#   3. the files the SessionStart hook reads are present
#
# Usage: ./scripts/check-llms-drift.sh
# Exit: 0 = no drift, 1 = drift found.

set -uo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 1

FILES=(llms.txt llms-full.txt)

FAILED=0

echo "=== llms context drift check ==="

# --- 1. referenced repository paths exist -----------------------------------

# Collect backtick-quoted tokens that look like repository paths.
PATHS=$(grep -ohE '`[A-Za-z0-9_./-]+/[^`]*`' "${FILES[@]}" 2>/dev/null \
  | tr -d '`' \
  | sed 's/[.,;:)]*$//' \
  | sort -u)

MISSING_PATHS=0
while IFS= read -r path; do
  [ -z "${path}" ] && continue
  # Skip URL-like and glob-ish tokens, and anything that is clearly prose.
  case "${path}" in
    http*|~*|/*) continue ;;
  esac
  # Skip placeholder and templated paths (they document a shape, not a file).
  # `case` patterns are matched byte-wise, so the multibyte ellipsis is not
  # used here; the ASCII placeholders cover every real template in the files.
  case "${path}" in
    *'<'*|*'>'*|*'...'*) continue ;;
  esac
  # Only check plausible repository paths (contain a slash and a known root).
  case "${path}" in
    apps/*|packages/*|scripts/*|docs/*|plans/*|analysis/*|.github/*|agents-docs/*|.agents/*) ;;
    *) continue ;;
  esac
  # A path with a wildcard or a trailing slash is a directory reference.
  if [ -e "${path}" ]; then
    continue
  fi
  echo "  MISSING path: ${path}"
  MISSING_PATHS=$((MISSING_PATHS + 1))
done <<< "${PATHS}"

if [ "${MISSING_PATHS}" -gt 0 ]; then
  echo "  ${MISSING_PATHS} referenced path(s) no longer exist."
  FAILED=1
else
  echo "  All referenced repository paths exist."
fi

# --- 2. documented commands still exist --------------------------------------

COMMANDS=$(grep -ohE '^(pnpm [a-z0-9:_-]+|\./scripts/[A-Za-z0-9_.-]+\.sh)' "${FILES[@]}" 2>/dev/null | sort -u)

MISSING_COMMANDS=0
while IFS= read -r cmd; do
  [ -z "${cmd}" ] && continue
  if [ "${cmd}" = "./scripts/quality_gate.sh" ]; then
    if [ ! -f "scripts/quality_gate.sh" ]; then
      echo "  MISSING script: ${cmd}"
      MISSING_COMMANDS=$((MISSING_COMMANDS + 1))
    fi
    continue
  fi
  if [[ "${cmd}" == pnpm\ * ]]; then
    script="${cmd#pnpm }"
    # `pnpm --filter <pkg> <script>` runs a workspace script; the script name
    # is the last token and lives in a package's package.json, not the root's.
    if [[ "${script}" == --filter* ]]; then
      script="${script##* }"
    fi
    # A filter with no script name is a prefix, not a runnable command.
    if [ -z "${script}" ] || [[ "${script}" == --* ]]; then
      continue
    fi
    # Built-in pnpm commands are not package scripts.
    case "${script}" in
      install|add|remove|exec|dlx|publish|version|list|why|audit|outdated|update|store) continue ;;
    esac
    # `pnpm test:coverage` and friends live in the root package.json.
    if ! node -e "
      const pkg = require('./package.json');
      const name = process.argv[1];
      process.exit(pkg.scripts && pkg.scripts[name] ? 0 : 1);
    " "${script}" 2>/dev/null; then
      echo "  MISSING pnpm script: ${cmd}"
      MISSING_COMMANDS=$((MISSING_COMMANDS + 1))
    fi
    continue
  fi
  if [ ! -f "${cmd#./}" ]; then
    echo "  MISSING script: ${cmd}"
    MISSING_COMMANDS=$((MISSING_COMMANDS + 1))
  fi
done <<< "${COMMANDS}"

if [ "${MISSING_COMMANDS}" -gt 0 ]; then
  echo "  ${MISSING_COMMANDS} documented command(s) no longer exist."
  FAILED=1
else
  echo "  All documented commands still exist."
fi

# --- 3. the SessionStart hook's inputs are present --------------------------

for required in llms.txt CHANGELOG.md scripts/hooks/claude-session-start.sh; do
  if [ ! -f "${required}" ]; then
    echo "  MISSING hook input: ${required}"
    FAILED=1
  fi
done
echo "  SessionStart hook inputs are present."

echo
if [ "${FAILED}" -ne 0 ]; then
  echo "llms context drift detected."
  exit 1
fi
echo "No llms context drift."
exit 0
