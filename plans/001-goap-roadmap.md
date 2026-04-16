# 001 – GOAP Roadmap

## Goal

Deliver a production-grade EPUB reading + editorial workspace with secure grants, offline sync, and auditability.

## Initial World State

- Monorepo scaffold exists but lacks observability, i18n, hardened flows.
- Plans/ADRs in place; TRIZ contradictions resolved.
- Reader/Admin MVP screens wired but not feature-complete.

## Desired World State

- Cloudflare Worker API with structured logging, tracing, and consistent error responses.
- Web PWA with global error boundaries, localized UI (en/de/fr), memory-safe async flows, and offline caching.
- Automated lint/format/build pipeline with 2026 guardrails.
- Documented workflows + reusable skills enforced for every agent.

## Action Graph (Phases)

1. **Foundation Refresh**
   - Update `AGENTS.md`, plans/, and skill library per coding guide.
   - Install lint/format/type/build tooling + CI hooks.
   - Document coding workflow + observability expectations.

2. **Observability + Safety**
   - Worker: trace-aware router, structured logs, consistent JSON errors.
   - Web: telemetry helpers, error boundaries, AbortController cleanups, service worker skeleton.

3. **Internationalization**
   - Locale-aware stores + provider.
   - English, German, French catalogs with persistence + UI switcher.
   - Accept-Language + trace headers on every API call.

4. **Reader/Admin Enhancements**
   - API client with cancellation + timeout.
   - Reader/Admin screens localized, resilient, capability-aware.
   - Global logout + health messaging.

5. **Offline + Sync**
   - Cache strategy + IndexedDB schema.
   - Sync queue + conflict handling per ADR-005.

6. **Editorial + Admin depth**
   - Highlights/comments UI, audit surfacing, dashboards.

## Phase Guards

- Every phase must reference which TRIZ contradiction(s) it resolves.
- `./scripts/quality_gate.sh` must pass before advancing.
- Update `plans/007-implementation-phases.md` after each completed slice.

## Dependencies

- Skills: `triz-analysis`, `triz-solver`, `task-decomposition`, `parallel-execution`, `learn` (post-task), and new domain skills under `.agents/skills/`.
- ADRs 002–006 drive architecture commitments; do not diverge without amendments.

## Exit Criteria

- Observability + i18n shipped.
- Lint/type/test/build pipelines enforced in CI.
- Documentation + skills reflect the delivered system.

## April 2026 PR Audit & Quality Check (COMPLETE)

- [x] Audit all open GitHub PRs for validity and impact.
- [x] Document destructive/corrupted Dependabot branches.
- [x] Consolidate major dependency update blockers (TS6, Vite8, Tailwind4).
- [x] Resolve major dependency blockers and refactor for 2026 stack.
- [x] Cherry-pick and improve accessibility fixes from the audited branches.
