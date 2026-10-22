#!/usr/bin/env bats

setup() {
    SCRIPT="$BATS_TEST_DIRNAME/../madge-circular-check.cjs"
    TEST_TMP="${BATS_TEST_TMPDIR:-${TMPDIR:-/tmp}}/madge-circular-check-$$"
    mkdir -p "$TEST_TMP"
}

teardown() {
    rm -rf "$TEST_TMP"
}

@test "Madge checker reports TypeScript dependency cycles" {
    mkdir -p "$TEST_TMP/src"
    printf "import './b';\nexport const a = 1;\n" > "$TEST_TMP/src/a.ts"
    printf "import './a';\nexport const b = 2;\n" > "$TEST_TMP/src/b.ts"

    run env MADGE_PROJECT_ROOT="$TEST_TMP" node "$SCRIPT" src

    [ "$status" -eq 0 ]
    [[ "$output" == *"Found 1 circular dependencies"* ]]
    [[ "$output" == *"a.ts"* ]]
    [[ "$output" == *"b.ts"* ]]
}

@test "Madge checker fails closed on unresolved imports" {
    mkdir -p "$TEST_TMP/src"
    printf "import './missing';\nexport const source = 1;\n" > "$TEST_TMP/src/source.ts"

    run env MADGE_PROJECT_ROOT="$TEST_TMP" node "$SCRIPT" src

    [ "$status" -eq 2 ]
    [[ "$output" == *"Skipped 1 unresolved imports:"* ]]
    [[ "$output" == *"./missing"* ]]
}

@test "Madge checker resolves the Vite alias and raw text asset" {
    mkdir -p "$TEST_TMP/apps/web/src/stores" "$TEST_TMP/apps/web/src/config"
    printf "0.1.0\n" > "$TEST_TMP/VERSION"
    printf "export const token = 'fixture';\n" > "$TEST_TMP/apps/web/src/stores/auth.ts"
    printf "import version from '../../../../VERSION?raw';\nimport { token } from '@/stores/auth';\nexport { version, token };\n" > "$TEST_TMP/apps/web/src/config/probe.ts"

    run env MADGE_PROJECT_ROOT="$TEST_TMP" node "$SCRIPT" apps/web/src

    [ "$status" -eq 0 ]
    [[ "$output" == *"No circular dependency found!"* ]]
}

@test "Madge checker treats Vite and Cloudflare platform modules as external edges" {
    mkdir -p "$TEST_TMP/src"
    printf "import { registerSW } from 'virtual:pwa-register';\nimport { DurableObject } from 'cloudflare:workers';\nexport { registerSW, DurableObject };\n" > "$TEST_TMP/src/platform.ts"

    run node "$SCRIPT" "$TEST_TMP/src"

    [ "$status" -eq 0 ]
    [[ "$output" == *"No circular dependency found!"* ]]
}
