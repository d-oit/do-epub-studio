#!/usr/bin/env bash
# Phase 1: PRE_COMMIT - Validation
# Validates code quality, checks for secrets, verifies branch
# Exit 0 = validation passed, Exit 1 = validation failed

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Source shared libs
# shellcheck source=scripts/lib/colors.sh
source "$REPO_ROOT/scripts/lib/colors.sh"
# shellcheck source=scripts/lib/logging.sh
source "$REPO_ROOT/scripts/lib/logging.sh" validate

cd "$REPO_ROOT"

log "Running pre-commit validation..."
echo ""

CURRENT_BRANCH=$(git branch --show-current)

case "$CURRENT_BRANCH" in
    main|master)
        error "Cannot commit directly to $CURRENT_BRANCH branch"
        error "Create a feature branch first: git checkout -b feat/your-feature"
        exit 1
        ;;
esac

success "On feature branch: $CURRENT_BRANCH"

log "Running quality gate..."
echo ""

SKIP_QUALITY_GATE="${ATOMIC_COMMIT_SKIP_QUALITY_GATE:-false}"

if [[ "$SKIP_QUALITY_GATE" == "true" ]]; then
    warn "Quality gate skipped (ATOMIC_COMMIT_SKIP_QUALITY_GATE=true)"
    success "Quality gate bypassed"
elif [[ -x "$REPO_ROOT/scripts/quality_gate.sh" ]]; then
    # Run quality gate without SKIP_TESTS override — tests must pass
    if ! "$REPO_ROOT/scripts/quality_gate.sh"; then
        error "Quality gate failed - fix all warnings before committing"
        exit 1
    fi
else
    error "quality_gate.sh not found or not executable"
    exit 1
fi

echo ""
success "Quality gate passed"

log "Scanning for secrets..."

# Enhanced secret detection patterns — covers dotenv, JSON, YAML, JS/TS, and common formats
SECRET_PATTERNS=(
    # API keys with various delimiters and quote styles
    "api[_-]?key\s*[:=]\s*['\"][a-zA-Z0-9]{16,}['\"]"
    "api[_-]?key\s*[:=]\s*[a-zA-Z0-9]{16,}"
    # Passwords
    "password\s*[:=]\s*['\"][^'\"]{4,}['\"]"
    # Generic secrets
    "secret\s*[:=]\s*['\"][a-zA-Z0-9]{16,}['\"]"
    # Private keys
    "private[_-]?key\s*[:=]\s*['\"][a-zA-Z0-9+/=]{20,}['\"]"
    # AWS access keys
    "AKIA[0-9A-Z]{16}"
    # GitHub tokens
    "gh[pousr]_[A-Za-z0-9_]{36,}"
    # Generic long hex strings that look like tokens
    "(token|auth_token|access_token)\s*[:=]\s*['\"][a-f0-9]{32,}['\"]"
)

SECRET_FOUND=false
STAGED_FILES=$(git diff --cached --name-only 2>/dev/null || true)

if [[ -n "$STAGED_FILES" ]]; then
    # Scan staged content, not working tree
    STAGED_DIFF=$(git diff --cached 2>/dev/null || true)
    if [[ -n "$STAGED_DIFF" ]]; then
        for pattern in "${SECRET_PATTERNS[@]}"; do
            if echo "$STAGED_DIFF" | grep -iE "$pattern" > /dev/null 2>&1; then
                error "Potential secret detected matching pattern: ${pattern:0:40}..."
                SECRET_FOUND=true
            fi
        done
    fi
fi

if [[ "$SECRET_FOUND" == true ]]; then
    error "Secrets detected in staged changes"
    error "Remove secrets and use environment variables or secret management"
    exit 1
fi

success "No secrets detected"

# Warn about unstaged/untracked files (will NOT be included in atomic commit)
UNSTAGED_FILES=$(git diff --name-only 2>/dev/null || true)
UNTRACKED_FILES=$(git ls-files --others --exclude-standard 2>/dev/null || true)

if [[ -n "$UNSTAGED_FILES" ]] || [[ -n "$UNTRACKED_FILES" ]]; then
    warn "Unstaged/untracked files exist (will NOT be committed):"
    [[ -n "$UNSTAGED_FILES" ]] && printf '%s\n' "$UNSTAGED_FILES" | sed 's/^/  unstaged: /'
    [[ -n "$UNTRACKED_FILES" ]] && printf '%s\n' "$UNTRACKED_FILES" | sed 's/^/  untracked: /'
    log "Stage these files to include them in the atomic commit"
fi

if ! command -v gh &> /dev/null; then
    error "GitHub CLI (gh) not found"
    error "Install from: https://cli.github.com/"
    exit 1
fi

if ! gh auth status &>/dev/null; then
    error "GitHub CLI not authenticated"
    error "Run: gh auth login"
    exit 1
fi

success "GitHub CLI authenticated"

echo ""
success "═════════════════════════════════════════════════════════════════"
success "  All Pre-Commit Validations PASSED"
success "═════════════════════════════════════════════════════════════════"

exit 0
