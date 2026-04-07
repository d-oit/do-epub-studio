---
name: shell-script-quality
description: Lint and test shell scripts using ShellCheck and BATS. Use when checking bash/sh scripts for errors, writing shell script tests, fixing ShellCheck warnings, or improving bash code quality.
version: "1.0"
---

# Shell Script Quality

Comprehensive shell script linting and testing using ShellCheck and BATS.

## Quick Start

1. Lint with ShellCheck
2. Fix reported issues
3. Write BATS tests
4. Verify tests pass

## Core Workflow

### Lint with ShellCheck

```bash
# Lint single file
shellcheck script.sh

# Lint all scripts
find scripts -name "*.sh" -exec shellcheck {} +
```

### Common Fixes

- SC2086: Quote variables: `"$var"` not `$var`
- SC2155: Separate declaration and assignment
- SC2181: Check exit code directly with `if ! command`

### Write BATS Tests

```bash
#!/usr/bin/env bats

setup() {
    source "$BATS_TEST_DIRNAME/../scripts/example.sh"
}

@test "function succeeds with valid input" {
    run example_function "test"
    [ "$status" -eq 0 ]
    [ -n "$output" ]
}
```

### Run Tests

```bash
bats tests/
```

## Script Template

```bash
#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

error_exit() {
    echo "ERROR: $1" >&2
    exit "${2:-1}"
}

main() {
    [[ $# -lt 1 ]] && {
        echo "Usage: $0 <argument>" >&2
        exit 1
    }
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
```

## Configuration

**.shellcheckrc** in project root:
```
shell=bash
disable=SC1090
enable=all
source-path=SCRIPTDIR
```

## Validation Loop Pattern

1. Make changes to script
2. Validate immediately: `shellcheck script.sh`
3. If validation fails: fix and retry
4. Only proceed when validation passes
5. Run tests: `bats tests/script.bats`
