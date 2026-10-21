#!/usr/bin/env bash
# report-dora.sh — report-only DORA metrics for the dev loop.
#
# GOAP-276 Phase 2: `do-harness dora` (report-only `warn` + FINDINGS ratchet)
# instead of the template's metrics script stack.
#
# `do-harness dora` exits 1 when a policy threshold is breached. That is the
# right behavior for a policy gate, but a deployment-metrics trend is not a
# merge condition: a slow lead time or a low deploy count in the window says
# something about the last 30 days, not about whether the change in front of
# us is correct. This wrapper therefore always exits 0 and reports the trend
# as a warning, so the signal is visible without blocking a merge.
#
# The policy lives in `plans/dora.json`. The thresholds there are reviewed
# deliberately: a breach is a signal to look, not a failure.
#
# Usage: ./scripts/report-dora.sh
# Env:
#   DORA_REQUIRED=1  exit non-zero when a threshold is breached (opt-in gate)

set -uo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 0

REQUIRED="${DORA_REQUIRED:-0}"

if ! command -v do-harness >/dev/null 2>&1; then
  echo "::warning::do-harness is not installed; skipping the DORA report"
  exit 0
fi

if [ ! -f "plans/dora.json" ]; then
  echo "::warning::plans/dora.json is missing; skipping the DORA report"
  exit 0
fi

echo "::group::DORA metrics (report only)"

OUTPUT="$(do-harness dora 2>&1)"
STATUS=$?

# The measured report is the interesting part; the trailing error line repeats
# the breach count, so it is dropped to keep one summary per run.
printf '%s\n' "$OUTPUT" | grep -v '^error: [0-9]* DORA threshold' || true

BREACHES="$(printf '%s\n' "$OUTPUT" | sed -n 's/^FINDINGS: \([0-9][0-9]*\)$/\1/p' | head -1)"

if [ "${STATUS:-0}" -ne 0 ] && [ -z "${BREACHES}" ]; then
  # The command itself failed (bad policy, unreadable git history). That is a
  # problem with the report, not with the repository, so it stays a warning.
  echo "::warning::do-harness dora could not produce a report (exit ${STATUS})"
elif [ -n "${BREACHES}" ] && [ "${BREACHES}" -gt 0 ]; then
  echo "::warning::DORA: ${BREACHES} threshold(s) breached over the window — trend signal only, not a merge condition"
  if [ "$REQUIRED" = "1" ]; then
    echo "::error::DORA: ${BREACHES} threshold(s) breached (DORA_REQUIRED=1)"
    echo "::endgroup::"
    exit 1
  fi
else
  echo "DORA: no threshold breached over the window."
fi

echo "::endgroup::"
exit 0
