# Release notes template

Used as the published GitHub Release body (`body_path` in
`.github/workflows/release.yml`). Keep it short; the CHANGELOG section is the
authoritative list of changes.

## Assets

- `do-epub-studio-web.zip` — the built web distribution
- `sbom.cyclonedx.json` — CycloneDX SBOM of the dependency tree
- `SHA256SUMS` — checksums for the two files above
- `*.sig` — keyless cosign signatures; the signing certificate is not
  published, so use the build-provenance attestation below as the supported
  verification path

## Verify this release

```bash
TAG=vX.Y.Z   # the tag you are verifying
gh release download "$TAG" --repo d-oit/do-epub-studio \
  --pattern SHA256SUMS --pattern do-epub-studio-web.zip

# 1. Checksum the artifact you downloaded
sha256sum -c SHA256SUMS --ignore-missing

# 2. Prove the artifact was built by this repository's release workflow
gh attestation verify do-epub-studio-web.zip --repo d-oit/do-epub-studio
```

The attestation binds the file's digest to the workflow run that produced it,
so a passing `--ignore-missing` checksum plus a passing attestation means the
bytes are the ones CI signed, not a re-upload.
