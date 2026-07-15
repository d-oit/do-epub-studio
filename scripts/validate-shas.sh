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
    "actions/setup-node@2028fbc5c25fe9cf00d9f06a71cc4710d4507903"
    "actions/stale@b5d41d4e1d5dceea10e7104786b73624c18a190f"
    "actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02"
    "cloudflare/wrangler-action@ebbaa1584979971c8614a24965b4405ff95890e0"
    "codecov/codecov-action@e79a6962e0d4c0c17b229090214935d2e33f8354"
    "codecov/codecov-action@75cd11691c0faa626561e295848008c8a7dddffe"
    "dependabot/fetch-metadata@25dd0e34f4fe68f24cc83900b1fe3fe149efef98"
    "github/codeql-action/analyze@60168efe1c415ce0f5521ea06d5c2062adbeed1b"
    "github/codeql-action/init@60168efe1c415ce0f5521ea06d5c2062adbeed1b"
    "pnpm/action-setup@0e279bb959325dab635dd2c09392533439d90093"
    "nick-fields/retry@ad984534de44a9489a53aefd81eb77f87c70dc60"
    "slackapi/slack-github-action@45a88b9581bfab2566dc881e2cd66d334e621e2c"
    "actions/github-script@d746ffe35508b1917358783b479e04febd2b8f71"
    "softprops/action-gh-release@b4309332981a82ec1c5618f44dd2e27cc8bfbfda"
    "chromaui/action@155dfb6e769c37734a53d98ce5f9ceb295e23a60"
    "treosh/lighthouse-ci-action@3e7e23fb74242897f95c0ba9cabad3d0227b9b18"
    "ossf/scorecard-action@f49aabe0b5af0936a0987cfb85d86b75731b0186"
    "actions/attest-build-provenance@a2bbfa25375fe432b6a289bc6b6cd05ecd0c4c32"
    "sigstore/cosign-installer@7e8b541eb2e61bf99390e1afd4be13a184e9ebc5"
    "sigstore/cosign-installer@6f9f17788090df1f26f669e9d70d6ae9567deba6"
    "actions/checkout@df4cb1c069e1874edd31b4311f1884172cec0e10"
    "actions/github-script@3a2844b7e9c422d3c10d287c895573f7108da1b3"
    "ossf/scorecard-action@4eaacf0543bb3f2c246792bd56e8cdeffafb205a"
    "actions/stale@eb5cf3af3ac0a1aa4c9c45633dd1ae542a27a899"
    "actions/labeler@5f867a63be70efff62b767459b009290364495eb"
    "dorny/paths-filter@f3ceefdc7ef57bc2d8560787d4b6c33e44044cec"
    "codecov/codecov-action@fb8b3582c8e4def4969c97caa2f19720cb33a72f"
    "github/codeql-action/init@8aad20d150bbac5944a9f9d289da16a4b0d87c1e"
    "github/codeql-action/analyze@8aad20d150bbac5944a9f9d289da16a4b0d87c1e"
    "chromaui/action@d92ea1ce501f70e8c34745b2c7888648150a368a"
    "actions/labeler@f27b608878404679385c85cfa523b85ccb86e213"
    "chromaui/action@1db61b73b7919508ee8e62336f04bd0aed6da756"
    "actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0"
    "actions/attest-build-provenance@0f67c3f4856b2e3261c31976d6725780e5e4c373"
    "softprops/action-gh-release@718ea10b132b3b2eba29c1007bb80653f286566b"
    "chromaui/action@7ffa9343588f15ff3f4cde30e03cd23204ed6a9c"
    "dorny/paths-filter@9af6e5a9d010d1ae8ec570390b3d793e2b70a402"
    "dorny/paths-filter@b41dfa943b1939b9b646f67753bfe35cf6e4de03"
    "github/codeql-action/init@54f647b7e1bb85c95cddabcd46b0c578ec92bc1a"
    "github/codeql-action/analyze@54f647b7e1bb85c95cddabcd46b0c578ec92bc1a"
    "chromaui/action@94713c544284a14195de3b50ef24301579f1877e"
    "actions/labeler@b8dd2d9be0f68b860e7dae5dae7d772984eacd6d"
    "actions/stale@1e223db275d687790206a7acac4d1a11bd6fe629"
    "github/codeql-action/init@99df26d4f13ea111d4ec1a7dddef6063f76b97e9"
    "github/codeql-action/analyze@99df26d4f13ea111d4ec1a7dddef6063f76b97e9"
    "github/codeql-action/upload-sarif@60168efe1c415ce0f5521ea06d5c2062adbeed1b"
    "slackapi/slack-github-action@0d95c9a7becc1e6e297d76df9bc735c44f4cbcbc"
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
