#!/usr/bin/env bash
# File-presence checks for scripts/quality_gate.sh.
quality_gate_has_file() {
    local pattern="$1"
    find . -name "$pattern" -not -path "./.git/*" -print -quit | grep -q .
}
