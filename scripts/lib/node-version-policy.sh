#!/usr/bin/env bash

# Keep in sync with package.json engines.node and the CI/release Node matrices:
# Node 22.13+ and Node 24.x are supported; other majors are rejected.
node_version_is_supported() {
    local version="${1:-}"
    if [[ ! "$version" =~ ^v([0-9]+)\.([0-9]+)\.[0-9]+$ ]]; then
        return 1
    fi

    local major="${BASH_REMATCH[1]}"
    local minor="${BASH_REMATCH[2]}"
    (( (10#$major == 22 && 10#$minor >= 13) || 10#$major == 24 ))
}
