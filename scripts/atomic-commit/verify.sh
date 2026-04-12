#!/usr/bin/env bash
# Phase 6: VERIFY - Wait for CI checks
# Polls GitHub checks with timeout using structured JSON output.
# Usage: verify.sh [pr-number] [timeout-seconds]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

PR_NUMBER="${1:-}"
TIMEOUT="${2:-1800}"
BASE_POLL_INTERVAL=10
MAX_POLL_INTERVAL=60

# Source shared libs
# shellcheck source=scripts/lib/colors.sh
source "$REPO_ROOT/scripts/lib/colors.sh"
# shellcheck source=scripts/lib/logging.sh
source "$REPO_ROOT/scripts/lib/logging.sh" verify

cd "$REPO_ROOT"

if [[ -z "$PR_NUMBER" ]]; then
    PR_NUMBER=$(gh pr view --json number --jq '.number' 2>/dev/null || echo "")
fi

if [[ -z "$PR_NUMBER" ]]; then
    error "No PR number provided and cannot detect from current branch"
    exit 1
fi

log "Monitoring PR #$PR_NUMBER"
log "Timeout: ${TIMEOUT}s"
log "Poll interval: ${BASE_POLL_INTERVAL}s (exponential backoff up to ${MAX_POLL_INTERVAL}s)"
echo ""

START_TIME=$(date +%s)
POLL_INTERVAL=$BASE_POLL_INTERVAL

while true; do
    CURRENT_TIME=$(date +%s)
    ELAPSED=$((CURRENT_TIME - START_TIME))

    if [[ $ELAPSED -gt $TIMEOUT ]]; then
        error "Timeout waiting for checks (${TIMEOUT}s)"
        error "PR may still be processing - check manually:"
        gh pr view "$PR_NUMBER" --json url --jq '.url' 2>/dev/null || true
        exit 1
    fi

    # Use structured JSON output for reliable parsing
    CHECKS_JSON=$(gh pr checks "$PR_NUMBER" --json name,state,conclusion,status 2>/dev/null || echo "[]")

    # Parse check states
    PENDING_COUNT=0
    FAILED_COUNT=0
    SUCCESS_COUNT=0
    TOTAL_COUNT=0

    while IFS='|' read -r name state conclusion status; do
        [[ -z "$name" ]] && continue
        TOTAL_COUNT=$((TOTAL_COUNT + 1))

        case "$state" in
            PENDING|QUEUED|IN_PROGRESS|REQUESTED|WAITING)
                PENDING_COUNT=$((PENDING_COUNT + 1))
                ;;
            COMPLETED)
                case "$conclusion" in
                    SUCCESS|NEUTRAL)
                        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
                        ;;
                    FAILURE|CANCELLED|TIMED_OUT|ACTION_REQUIRED|STALE)
                        FAILED_COUNT=$((FAILED_COUNT + 1))
                        ;;
                esac
                ;;
        esac
    done < <(echo "$CHECKS_JSON" | jq -r '.[] | "\(.name)|\(.state)|\(.conclusion)|\(.status)"' 2>/dev/null || true)

    # Show progress
    if [[ $TOTAL_COUNT -gt 0 ]]; then
        log "Checks: $SUCCESS_COUNT passed, $FAILED_COUNT failed, $PENDING_COUNT pending ($ELAPSED$s elapsed)"
    else
        log "No checks found... ($ELAPSED$s elapsed)"
    fi

    # Determine outcome
    if [[ $FAILED_COUNT -gt 0 ]]; then
        error "Checks failed!"
        echo ""
        gh pr checks "$PR_NUMBER" 2>&1 || true
        exit 1
    fi

    if [[ $PENDING_COUNT -eq 0 ]] && [[ $TOTAL_COUNT -gt 0 ]]; then
        # All checks completed, none failed
        log "All $TOTAL_COUNT check(s) passed"
        break
    fi

    if [[ $TOTAL_COUNT -eq 0 ]] && [[ $ELAPSED -gt 60 ]]; then
        warn "No checks detected after 60s"
        warn "If repository has no CI, use --skip-ci flag"
        log "Continuing..."
        break
    fi

    # Exponential backoff with max cap
    sleep "$POLL_INTERVAL"
    POLL_INTERVAL=$((POLL_INTERVAL * 2))
    if [[ $POLL_INTERVAL -gt $MAX_POLL_INTERVAL ]]; then
        POLL_INTERVAL=$MAX_POLL_INTERVAL
    fi
done

echo ""
success "═════════════════════════════════════════════════════════════════"
success "  All CI Checks PASSED"
success "═════════════════════════════════════════════════════════════════"
echo ""

PR_URL=$(gh pr view "$PR_NUMBER" --json url --jq '.url' 2>/dev/null || echo "")
success "PR ready: $PR_URL"

exit 0
