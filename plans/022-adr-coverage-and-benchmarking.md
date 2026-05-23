# ADR-022: Coverage Reporting & Benchmark Infrastructure

**Status:** Accepted
**Date:** 2026-05-15
**Driven by:** Plan 023 audit — coverage is generated but never uploaded; benchmarks exist but never run in CI

---

## Context

The codebase currently generates coverage data via `pnpm test:coverage` (vitest with `@vitest/coverage-v8`) in both local dev and CI. However:

- **Coverage data is never uploaded** to any service. In CI, the coverage output is captured to `verification_output.txt` (7-day retention) but there is no trend tracking, no PR comments, no coverage gating.
- **Thresholds are only enforced locally** during `pnpm test:coverage` via vitest config. CI runs the same command but exit codes from threshold failures are mixed with test failures.
- **There is no `codecov.yml`** or any coverage service configuration.
- **AGENTS.md references coverage thresholds** (web: 40% lines, worker: 55%, shared: 25%, reader-core: 75%) but CI has no mechanism to enforce or report on them.

For benchmarking:

- `packages/reader-core/src/reader-core.bench.ts` exists with 7 benchmarks
- `pnpm bench` script exists in root `package.json`
- Benchmarks are **never run in CI** — no benchmark step, no performance regression detection, no historical tracking

---

## Decision

### Coverage

1. **Add a coverage upload step to CI** — use Codecov (or alternative) to upload vitest coverage reports
2. **Create `codecov.yml`** with per-package threshold configuration matching AGENTS.md
3. **Coverage upload runs as part of `test` job** in CI, not as a separate job
4. **Coverage status is informational only (not blocking)** for the first 2 sprints, then becomes blocking
5. **Ensure coverage reports are generated in a format compatible** with the chosen service (lcovonly)

### Benchmarking

1. **Add a `bench` CI job** — runs after `build`, invokes `pnpm bench`, stores raw results as artifact
2. **Benchmark results are informational only** — no automatic pass/fail, no regression comparison
3. **Add benchmark result to `verification_output.txt`** for manual review in PR artifacts
4. **Future consideration:** Evaluate codspeed.io or comparable for benchmark regression tracking

---

## Options Considered

### Coverage Service

| Option                  | Pros                                                                                    | Cons                                                               |
| ----------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **Codecov (chosen)**    | De facto standard; free for open source; GitHub integration; vitest has built-in output | Requires org setup; token management                               |
| Coveralls               | Also well-known                                                                         | Slightly less adoption; fewer GitHub integrations                  |
| SonarCloud              | Advanced static analysis                                                                | Heavy integration; overkill for this scope                         |
| No service (status quo) | Zero setup                                                                              | No trend tracking; no PR feedback; coverage data lost after 7 days |

### Benchmark Tracking

| Option                           | Pros                                        | Cons                                           |
| -------------------------------- | ------------------------------------------- | ---------------------------------------------- |
| **CI artifact storage (chosen)** | Zero-cost; simple; immediate                | Manual review only; no trend dashboard         |
| codspeed.io                      | Automated regression detection; PR comments | Additional setup; potential cost               |
| GitHub Actions Benchmark Action  | Community-driven; PR comments               | Maintenance burden; action compatibility       |
| No benchmark in CI (status quo)  | Zero effort                                 | Benchmarks never validated; silent regressions |

---

## Implementation

### Coverage CI Integration

```yaml
# In ci.yml, within test job or as new step:
- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v5
  with:
    token: ${{ secrets.CODECOV_TOKEN }}
    directory: ./coverage
    flags: unittests
    fail_ci_if_error: false # informational initially
```

### codecov.yml

```yaml
coverage:
  status:
    project:
      default:
        informational: true
      web:
        target: 40%
        flags: web
      worker:
        target: 55%
        flags: worker
      shared:
        target: 25%
        flags: shared
      reader-core:
        target: 75%
        flags: reader-core
    patch:
      default:
        informational: true
        target: 80%

flag_management:
  individual_flags:
    - name: web
      paths:
        - apps/web/
    - name: worker
      paths:
        - apps/worker/
    - name: shared
      paths:
        - packages/shared/
    - name: reader-core
      paths:
        - packages/reader-core/
    - name: schema
      paths:
        - packages/schema/
    - name: testkit
      paths:
        - packages/testkit/
    - name: ui
      paths:
        - packages/ui/
```

### Vitest Coverage Output Configuration

In each `vitest.config.ts`, ensure coverage output format includes lcov:

```typescript
coverage: {
  provider: 'v8',
  reporter: ['text', 'json', 'lcov', 'clover'],
  reportsDirectory: '../../coverage',
  // ...thresholds
}
```

### Benchmark CI Step

```yaml
bench:
  runs-on: ubuntu-latest
  needs: [build]
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v5
    - uses: actions/setup-node@v4
    - run: pnpm install --frozen-lockfile
    - run: pnpm bench
    - run: pnpm bench >> verification_output.txt
    - uses: actions/upload-artifact@v4
      with:
        name: benchmark-results
        path: verification_output.txt
```

---

## Consequences

### Positive

- Coverage trends visible in PRs and dashboard
- Quality gates become enforceable across all packages
- Benchmark regressions visible to reviewers
- Coverage data survives beyond 7-day artifact retention
- Per-package flags enable granular threshold enforcement

### Negative / Risks

- Codecov token must be stored as a GitHub secret
- Initial coverage upload may fail if `coverage/` directory structure is inconsistent across packages
- Benchmark data must be interpreted manually (no automated regression detection)
- Adding CI steps increases workflow runtime (~30s for coverage upload, ~60s for bench)

### Mitigations

- `fail_ci_if_error: false` until integration is validated
- Standardize coverage output directory to `../../coverage` (relative to each package root)
- Benchmark step is non-blocking; if it fails, the workflow continues
- Token can use Codecov's GitHub app integration (no token needed for public repos)

---

## References

- Plan 020 — Sprint #141 implementation tasks
- Plan 023 — Comprehensive audit findings
- `ci.yml` — Existing CI workflow
- `packages/reader-core/src/reader-core.bench.ts` — Existing benchmark file
- AGENTS.md — Coverage threshold requirements
- `@vitest/coverage-v8` — Current coverage provider
