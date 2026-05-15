#!/usr/bin/env bash
# Local GitHub Actions runner wrapper using nektos/act
# Runs workflows locally with Docker for fast feedback.
# Usage: ./scripts/run_act_local.sh [--workflow ci.yml] [--list]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Source shared libs
# shellcheck source=scripts/lib/colors.sh
source "$REPO_ROOT/scripts/lib/colors.sh"

readonly E_SUCCESS=0
readonly E_NOT_INSTALLED=1
readonly E_RUN_FAILED=2

WORKFLOW="ci.yml"
LIST_MODE=false

show_help() {
    cat << 'EOF'
Usage: run_act_local.sh [OPTIONS]

Run GitHub Actions workflows locally using nektos/act.

Options:
    -w, --workflow FILE   Workflow file to run (default: ci.yml)
    -l, --list            List available workflows
    -h, --help            Show this help message

Examples:
    ./scripts/run_act_local.sh
    ./scripts/run_act_local.sh --workflow e2e.yml
    ./scripts/run_act_local.sh --list

Requirements:
    - act (nektos/act) installed and in PATH
    - Docker daemon running

Environment:
    ACT_CACHE_DIR         Custom cache directory for act
    ACT_PLATFORM          Platform image override (e.g., ubuntu-latest=ghcr.io/catthehacker/ubuntu:act-latest)
EOF
    exit 0
}

parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                ;;
            -l|--list)
                LIST_MODE=true
                shift
                ;;
            -w|--workflow)
                if [[ -z "${2:-}" ]]; then
                    printf '%sError: --workflow requires a filename%s\n' "${RED}" "${NC}"
                    exit 1
                fi
                WORKFLOW="$2"
                shift 2
                ;;
            *)
                printf '%sUnknown option: %s%s\n' "${RED}" "$1" "${NC}"
                echo ""
                show_help
                ;;
        esac
    done
}

main() {
    parse_args "$@"

    cd "$REPO_ROOT"

    # Check if act is installed
    if ! command -v act &> /dev/null; then
        printf '%sact (nektos/act) is not installed.%s\n' "${RED}" "${NC}"
        echo ""
        echo "Install it with one of:"
        echo "  brew install act"
        echo "  curl -sS https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash"
        echo "  gh extension install https://github.com/nektos/gh-act"
        echo ""
        echo "See: https://github.com/nektos/act"
        exit $E_NOT_INSTALLED
    fi

    # List mode
    if [[ "$LIST_MODE" == true ]]; then
        printf '%sAvailable workflows:%s\n' "${BLUE}" "${NC}"
        act --list
        exit $E_SUCCESS
    fi

    # Validate workflow file exists
    local workflow_path="$REPO_ROOT/.github/workflows/$WORKFLOW"
    if [[ ! -f "$workflow_path" ]]; then
        printf '%sWorkflow file not found: %s%s\n' "${RED}" "$workflow_path" "${NC}"
        printf '%sRun --list to see available workflows.%s\n' "${YELLOW}" "${NC}"
        exit $E_RUN_FAILED
    fi

    printf '%sRunning workflow: %s%s\n' "${BLUE}" "$WORKFLOW" "${NC}"
    printf '%sWorkflow path: %s%s\n' "${BLUE}" "$workflow_path" "${NC}"
    echo ""

    # Build act command
    local act_cmd=("act")

    # Use medium-ish platform by default; allow override via env
    if [[ -n "${ACT_PLATFORM:-}" ]]; then
        act_cmd+=("--platform" "$ACT_PLATFORM")
    fi

    act_cmd+=("--workflows" "$workflow_path")
    act_cmd+=("--container-architecture" "linux/amd64")
    act_cmd+=("--reuse")

    if [[ -n "${ACT_CACHE_DIR:-}" ]]; then
        act_cmd+=("--cache-dir" "$ACT_CACHE_DIR")
    fi

    printf '%s$ %s%s\n' "${YELLOW}" "${act_cmd[*]}" "${NC}"
    echo ""

    if "${act_cmd[@]}"; then
        printf '%sWorkflow %s completed successfully.%s\n' "${GREEN}" "$WORKFLOW" "${NC}"
        exit $E_SUCCESS
    else
        local rc=$?
        printf '%sWorkflow %s failed (exit code: %d)%s\n' "${RED}" "$WORKFLOW" "$rc" "${NC}"
        exit $E_RUN_FAILED
    fi
}

main "$@"
