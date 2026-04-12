#!/usr/bin/env bash
# Shared logging helpers.
# Requires: REPO_ROOT and color variables (source colors.sh first).
# Usage: source "$REPO_ROOT/scripts/lib/logging.sh" [prefix]

# Optional prefix for log output (e.g., "[validate]", "[push]")
_LOG_PREFIX="${1:-}"

log() {
    if [[ -n "$_LOG_PREFIX" ]]; then
        echo -e "${BLUE}[$_LOG_PREFIX]${NC} $*"
    else
        echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $*"
    fi
}

error() {
    if [[ -n "$_LOG_PREFIX" ]]; then
        echo -e "${RED}[$_LOG_PREFIX]${NC} $*" >&2
    else
        echo -e "${RED}[$(date +%H:%M:%S)] ERROR:${NC} $*" >&2
    fi
}

success() {
    if [[ -n "$_LOG_PREFIX" ]]; then
        echo -e "${GREEN}[$_LOG_PREFIX]${NC} $*"
    else
        echo -e "${GREEN}[$(date +%H:%M:%S)]${NC} $*"
    fi
}

warn() {
    if [[ -n "$_LOG_PREFIX" ]]; then
        echo -e "${YELLOW}[$_LOG_PREFIX]${NC} $*" >&2
    else
        echo -e "${YELLOW}[$(date +%H:%M:%S)] WARNING:${NC} $*" >&2
    fi
}

log_phase() {
    log "Phase: $*"
}
