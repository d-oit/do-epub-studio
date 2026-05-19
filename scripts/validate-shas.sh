#!/usr/bin/env bash
# Allowed GitHub Action SHAs for security pinning.
# This file is used by scripts/validate-workflows.sh to ensure all external
# actions are pinned to a verified, immutable SHA.

# List of allowed external actions in action@sha format
ALLOWED_SHAS=(
    "actions/cache@1bd1e32a3bdc45362d1e726936510720a7c30a57"
    "actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683"
    "actions/download-artifact@cc203385981b70ca67e1cc392babf9cc229d5806"
    "actions/setup-node@1d0ff469b7ec7b3cb9d8673fde0c81c44821de2a"
    "actions/stale@5bef64f19d7facfb25b37b414482c7164d639639"
    "actions/stale@b5d41d4e1d5dceea10e7104786b73624c18a190f"
    "actions/upload-artifact@4cec3d8aa04e39d1a68397de0c4cd6fb9dce8ec1"
    "cloudflare/wrangler-action@9acf94ace14e7dc412b076f2c5c20b8ce93c79cd"
    "codecov/codecov-action@75cd11691c0faa626561e295848008c8a7dddffe"
    "dependabot/fetch-metadata@25dd0e34f4fe68f24cc83900b1fe3fe149efef98"
    "github/codeql-action/analyze@0fa1882f994fbd81a47ab0804f93354f5ea40147"
    "github/codeql-action/analyze@60168efe1c415ce0f5521ea06d5c2062adbeed1b"
    "github/codeql-action/init@0fa1882f994fbd81a47ab0804f93354f5ea40147"
    "github/codeql-action/init@60168efe1c415ce0f5521ea06d5c2062adbeed1b"
    "pnpm/action-setup@b307475762933b98ed359c036b0e51f26b63b74b"
    "softprops/action-gh-release@b4309332981a82ec1c5618f44dd2e27cc8bfbfda"
)

# Function to check if an action@sha is allowed
# Usage: is_allowed_sha "actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683"
is_allowed_sha() {
    local action_with_sha="$1"
    for allowed in "${ALLOWED_SHAS[@]}"; do
        if [[ "$action_with_sha" == "$allowed" ]]; then
            return 0
        fi
    done
    return 1
}

# If executed directly, list allowed SHAs
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    printf "Allowed GitHub Action SHAs:\n"
    for sha in "${ALLOWED_SHAS[@]}"; do
        printf "  - %s\n" "$sha"
    done
fi
