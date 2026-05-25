#!/usr/bin/env bash
# Allowed GitHub Action SHAs for security pinning.
# This file is used by scripts/validate-workflows.sh to ensure all external
# actions are pinned to a verified, immutable SHA.

# List of allowed external actions in action@sha format
ALLOWED_SHAS=(
    "actions/cache@1bd1e32a3bdc45362d1e726936510720a7c30a57"
    "actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd"
    "actions/download-artifact@cc203385981b70ca67e1cc392babf9cc229d5806"
    "actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020"
    "actions/stale@b5d41d4e1d5dceea10e7104786b73624c18a190f"
    "actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02"
    "cloudflare/wrangler-action@ebbaa1584979971c8614a24965b4405ff95890e0"
    "codecov/codecov-action@e79a6962e0d4c0c17b229090214935d2e33f8354"
    "codecov/codecov-action@75cd11691c0faa626561e295848008c8a7dddffe"
    "dependabot/fetch-metadata@25dd0e34f4fe68f24cc83900b1fe3fe149efef98"
    "github/codeql-action/analyze@60168efe1c415ce0f5521ea06d5c2062adbeed1b"
    "github/codeql-action/init@60168efe1c415ce0f5521ea06d5c2062adbeed1b"
    "pnpm/action-setup@0e279bb959325dab635dd2c09392533439d90093"
    "nick-fields/retry@c97818ca39074beaea45180dba704f92496a0082"
    "slackapi/slack-github-action@485a9d42d3a73031f12ec201c457e2162c45d02d"
    "actions/github-script@f28e40c7f34bde8b3046d885e986cb6290c5673b"
    "softprops/action-gh-release@b4309332981a82ec1c5618f44dd2e27cc8bfbfda"
    "chromaui/action@e8cc4c31775280b175a3c440076c00d19a9014d7"
    "treosh/lighthouse-ci-action@3e7e23fb74242897f95c0ba9cabad3d0227b9b18"
    "ossf/scorecard-action@ea651e62978af7915d09fe2e282747c798bf2dab"
    "actions/attest-build-provenance@c074443f1aee8d4aeeae555aebba3282517141b2"
    "sigstore/cosign-installer@053f9b74638557590800a301da1ba82351507e2c"
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
