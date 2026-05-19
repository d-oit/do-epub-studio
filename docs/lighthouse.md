# Lighthouse / LHCI

## Status: ARCHIVED

Lighthouse measurement has been deferred per Plan 033 Group E. The previous document has been moved to `docs/archive/lighthouse.md`.

### References

- Issue #160 — Lighthouse / CWV re-measurement post UI/UX 2026 redesign (the tracking issue for restoration)
- Issue #172 — Decision to archive pending restoration
- Plan 033 Group E — Comprehensive gap analysis

### To restore:

1. Serve the app with a mock API backend for static Lighthouse runs
2. Or use a deployed preview URL
3. Install `@lhci/cli`, create `.lighthouserc.json`, and add LHCI to CI
4. Re-open issue #172 once restoration is complete
