# TRIZ Resolution — d.o.EPUB Studio (Maturity Phase)

**Date:** 2026-07-28
**Input:** `analysis/triz-core-2026-07-28.md`
**Supersedes:** `plans/archive/002-triz-resolution.md`

---

### Resolved: Contradiction 1 — Observability vs Reading Performance
**Status:** ✅ ALREADY IMPLEMENTED — No code changes needed.

**Problem:** Synchronous traceId emission, audit logging, and
telemetry events on the critical rendering path degrade reading
performance (time-to-interactive).

**IFR:** The system collects full observability data (traceId,
audit logs, telemetry) WITHOUT adding latency to the user-facing
reading path.

**Separation:** Time + Condition

**Solution (verified as already in place):**

1. **Fire-and-forget audit writes** — `logAudit()` at
   `audit/index.ts:92-116` already accepts optional
   `ctx?: { waitUntil }` parameter. When provided, it calls
   `ctx.waitUntil(promise)` and returns immediately without
   awaiting the INSERT. All 27 call sites pass
   `c.executionCtx` as the `ctx` argument, making every audit
   write fire-and-forget.
2. **Batch telemetry on the client** — `client-logger.ts`
   already buffers events and flushes via `navigator.sendBeacon()`
   with a 1-second debounce timer. Flushes also happen on
   `visibilitychange` (tab hidden) and `beforeunload`. Telemetry
   is never blocking.
3. **traceId is O(1)** — `createTraceId()` uses
   `crypto.randomUUID()`. The server middleware picks up the
   client-generated `x-trace-id` header via
   `request.headers.get(TRACE_HEADER) ?? createTraceId()`,
   avoiding duplicate generation.

**Why Better:** Already resolved. No performance impact from
observability on the reading path.

**New Contradictions:** NONE — `waitUntil` doesn't delay the HTTP
response body, it extends the Worker's lifetime. The client's
time-to-first-byte is unchanged.

---

### Resolved: Contradiction 2 — CSP Strictness vs WASM Capability

**Problem:** Strict CSP (`script-src 'self' 'wasm-unsafe-eval'`)
blocks `eval()`-based dynamic loading and creates friction for
WASM-heavy integrations like Argon2id and EPUB zip decompression.

**IFR:** The system enforces strong script integrity boundaries
WHILE permitting all legitimate WASM-based operations used by the
app.

**Separation:** Space (different CSP for different scopes) +
System-level (Worker boundaries)

**Solution:**

1. **Maintain current CSP as the outer policy** —
   `script-src 'self' 'wasm-unsafe-eval'` is already correct for
   the main document scope. WASM is explicitly permitted.
2. **Ensure EPUB render iframe has `sandbox` attribute with only
   `allow-same-origin`** — Already implemented. The sandbox is
   more restrictive than CSP and prevents any script execution
   inside the iframe (which is correct — EPUB content should not
   run scripts).
3. **Web Workers inherit parent CSP** — The EPUB parser Web
   Worker and reanchor worker already operate under the same CSP.
   WASM for zip decompression works because `wasm-unsafe-eval` is
   allowed. No change needed.
4. **For future WASM-heavy features (CRDT, PDF export)** —
   Instantiate WASM modules via
   `WebAssembly.instantiateStreaming()` which is CSP-compliant
   (no `eval()` dependency). Reject any library that requires
   `eval()` in its WASM glue code.

**Why Better:** No CSP changes needed. The current policy is
already sufficient. The key insight is that modern WASM
initialization APIs are CSP-compliant by design. The only real
restriction is `eval()`-based fallbacks in older WASM glue code,
which can be avoided through library selection.

**New Contradictions:** NONE — All current WASM usages
(Argon2id, epub zip) work. Future WASM modules just need to use
`instantiateStreaming`.

---

### Resolved: Contradiction 3 — Codebase Maturity vs Onboarding Velocity

**Problem:** The wealth of documented decisions (56+ ADRs, 20+
docs, 1584-line coding guide) creates a context wall for new
contributors, making initial tasks slower.

**IFR:** A new contributor makes their first meaningful
contribution WITHOUT reading all architecture docs, ADRs, or the
full AGENTS.md.

**Separation:** Condition (different paths for different
contributor goals) + Space (layered information)

**Solution:**

1. **Create a `CONTRIBUTING.md` quickstart** at repo root — A
   single-page guide that covers:
   - What is d.o.EPUB Studio? (3 sentences)
   - Prerequisites (Node, pnpm, Docker)
   - `make setup && make dev` (standard dev loop)
   - "I want to fix a bug" → workflow: branch → edit → `pnpm
     lint && pnpm typecheck` → commit via script → PR
   - "I want to understand the architecture" → link to
     `docs/coding-guide.md`
   - "I want to know why a decision was made" → link to
     `plans/ADR-INDEX.md`
2. **Add a CODEOWNERS file** so PRs auto-assign reviewers who can
   guide contributors through the quality gate workflow.
3. **Add `justfile` or `make dev-setup`** that handles the full
   environment setup (install deps, build, init DB, run health
   check) in one command.
4. **Mark ADR-INDEX.md with priority badges** — P0/P1/P2 labels
   so contributors can choose to read only the critical ADRs
   first.

**Why Better:** The quickstart path bypasses 90% of the context
wall. Contributors only dive deeper when their task requires it.
This follows the progressive disclosure principle already used in
the reader UI (annotation tools appear on selection).

**New Contradictions:** NONE — Existing docs remain intact. The
new files (CONTRIBUTING.md, CODEOWNERS) are additive and
self-contained.

---

### Resolved: Contradiction 4 — Deferred Infrastructure vs Deployment Readiness

**Problem:** The codebase is production-ready but 3 infrastructure
bindings (email transport, telemetry endpoint, EPUB re-export)
block actual production deployment.

**IFR:** The system deploys to production with all P1/P2 features
functional WITHOUT requiring production infrastructure
configuration that cannot be done in code.

**Separation:** System-level (add intermediary components) +
Condition (feature-flag gating)

**Solution:**

1. **Production email transport via Cloudflare Email Workers** —
   Instead of integrating a third-party email provider (SendGrid,
   etc.), implement email sending through Cloudflare's built-in
   `sendEmail` binding. This requires zero external API keys —
   just the binding definition in `wrangler.jsonc`. Implementation
   exists in `createEmailTransport()`; switch the mock to the
   real binding.
2. **Authenticated telemetry endpoint** — Add a
   `POST /api/telemetry` route behind the existing reader auth
   middleware. Store telemetry in Turso in a `telemetry_events`
   table. The client flushes telemetry to this endpoint instead of
   the external default. This requires no new infrastructure —
   just a route + a table migration.
3. **Feature-flag EPUB re-export** — Gate the full EPUB re-export
   behind a feature flag (`viteFeatureFlags.EPUB_REEXPORT`).
   Deploy the Markdown/HTML export as-is. The feature flag
   defaults to `false` in production, `true` in dev. This ensures
   the deployment isn't blocked by the EPUB re-export work.
4. **Infrastructure runbook** — Create
   `docs/ops/infrastructure-setup.md` that documents the exact
   Cloudflare dashboard steps (which bindings, which secrets,
   which DNS records) so a human operator can execute them in
   under 30 minutes.

**Why Better:** Email and telemetry become code-defined, not
infrastructure-defined. Cloudflare Email Workers and Worker
routes are provisioned in the same `wrangler.jsonc` as the main
app. The only human step is initially setting up the Cloudflare
account and domain.

**New Contradictions:** NONE — All components already exist in
the Worker architecture. No new external dependencies introduced.

---

### Resolved: Contradiction 5 — Local Development vs Production Parity

**Problem:** Local development uses Miniflare/mocks but production
uses real Turso + R2 + Durable Objects, creating a gap where
integration issues slip through.

**IFR:** Developers iterate quickly locally WHILE catching all
production-relevant integration issues before deploy.

**Separation:** Space (separate test tiers) + Condition (toggle
backends)

**Solution:**

1. **Existing unit tests stay local with Miniflare** — Fast,
   no external deps. Already in place with `pool: 'forks'`.
2. **Add staging workflow to CI** — A
   `ci-staging-integration.yml` workflow that deploys to a
   Cloudflare Preview environment (pointing to real Turso + R2)
   and runs the Playwright E2E suite against it. Triggered on PRs
   to `main` (not on every push).
3. **Turso local replica mode** — Configure Turso's local replica
   (`turso db shell --local`) so local dev uses a real Turso
   connection synced to a local SQLite copy. This gives closer
   parity than Miniflare's in-memory SQLite without requiring
   network access.
4. **Document the gap explicitly** — Update ADR-179 with the
   specific behavioral differences between Miniflare and
   production (DO rate limiter timing, R2 consistency, Turso
   edge latency) so developers know what to look for in staging.

**Why Better:** Staging catches production integration issues
before merge. Local dev remains fast. Turso local replica is a
medium-effort improvement that closes the largest gap (SQL
dialect differences). The documented gap helps developer awareness
without structural changes.

**New Contradictions:** NONE — All solutions are additive
(staging workflow, local replica config, ADR update). No existing
workflow is disrupted.

---

## Summary of Resolutions

| # | Contradiction | Separation | Key Solution | New Contradictions |
|---|---|---|---|---|
| 1 | Observability vs Performance | Time + Condition | `waitUntil` for audit writes, `requestIdleCallback` for telemetry batch | NONE |
| 2 | CSP vs WASM | Space + System-level | Current CSP sufficient; use `instantiateStreaming` for future WASM | NONE |
| 3 | Maturity vs Onboarding | Condition + Space | CONTRIBUTING.md quickstart, CODEOWNERS, make dev-setup | NONE |
| 4 | Infrastructure vs Deployment | System-level + Condition | CF Email Workers, `/api/telemetry` route, feature flags for EPUB export | NONE |
| 5 | Local Dev vs Production Parity | Space + Condition | Turso local replica, staging CI workflow, documented gap | NONE |

---

## Next Steps

1. **Create GOAP plan for Contradiction #4 resolution** — This is
   the highest-impact change (blocks production deployment).
   Implement: CF Email Workers binding, `/api/telemetry` route,
   feature flag system, and infrastructure runbook.
2. **Create GOAP plan for Contradiction #1 resolution** — Higher
   priority for UX. Implement: `waitUntil` audit writes,
   `requestIdleCallback` telemetry, SW pre-generated traceId.
3. **Create GOAP plan for Contradiction #3 resolution** — Medium
   priority. Create CONTRIBUTING.md, CODEOWNERS, dev-setup
   script.
4. **Update ADR-179** for Contradiction #5 documented gap.
5. **Verify no new contradictions** — Review each solution's
   impact on related system components.
