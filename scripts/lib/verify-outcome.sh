#!/usr/bin/env bash
# Outcome mapping for the VERIFY phase.
#
# verify.sh reports three states, and only a REAL failure may destroy work:
#   0  every check passed
#   1  at least one check failed
#   2  inconclusive — the run timed out, no checks ever appeared, or the GitHub
#      API could not be reached. The PR and the branch must be left intact:
#      closing a healthy PR and force-pushing the branch back is unrecoverable
#      for the operator's context (two PRs were lost that way before this split).
#
# Kept as a sourced function so the destructive branch is covered by a test
# rather than by reading run.sh.

# shellcheck disable=SC2034
VERIFY_OUTCOME_PASSED=0
VERIFY_OUTCOME_FAILED=1
VERIFY_OUTCOME_INCONCLUSIVE=2

# decide_verify_action <verify-exit-code> -> prints "passed" | "rollback" | "keep"
decide_verify_action() {
    case "${1:-}" in
        "$VERIFY_OUTCOME_PASSED") echo "passed" ;;
        "$VERIFY_OUTCOME_FAILED") echo "rollback" ;;
        *) echo "keep" ;;
    esac
}
