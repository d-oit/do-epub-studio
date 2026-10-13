#!/usr/bin/env bash
# Outcome mapping for the VERIFY phase.
#
# A failed check may destroy work only when this run created the PR. Existing
# PRs carry review history and belong to their current reviewers, so keep their
# branch and commit in place even when a check fails.
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

# decide_verify_action <verify-exit-code> [existing-pr] -> prints "passed" | "rollback" | "preserve" | "keep"
decide_verify_action() {
    case "${1:-}" in
        "$VERIFY_OUTCOME_PASSED") echo "passed" ;;
        "$VERIFY_OUTCOME_FAILED")
            if [[ -n "${2:-}" ]]; then
                echo "preserve"
            else
                echo "rollback"
            fi
            ;;
        *) echo "keep" ;;
    esac
}
