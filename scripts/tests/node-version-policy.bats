#!/usr/bin/env bats

setup() {
    source "$BATS_TEST_DIRNAME/../lib/node-version-policy.sh"
}

@test "accepts versions in the supported Node lines" {
    run node_version_is_supported v22.13.0
    [ "$status" -eq 0 ]

    run node_version_is_supported v22.99.0
    [ "$status" -eq 0 ]

    run node_version_is_supported v24.0.0
    [ "$status" -eq 0 ]

    run node_version_is_supported v24.99.0
    [ "$status" -eq 0 ]
}

@test "rejects versions outside package.json engines.node" {
    for version in v22.12.9 v23.0.0 v25.0.0 v26.0.0 v24.0.0-nightly invalid; do
        run node_version_is_supported "$version"
        [ "$status" -eq 1 ]
    done
}
