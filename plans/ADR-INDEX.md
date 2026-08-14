# ADR Index

> **Single source of truth for ADR numbers.**
> If a number is missing from this index, the ADR has not been
> written or has been merged into another. See
> `plans/archive/083-adr-adr-numbering-policy.md` for the numbering
> rule and the policy on collisions.

## Accepted

| Number | Title                                                                      | File                                                                     | Status                                                               |
| ------ | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| 002    | Monorepo Stack                                                             | `plans/archive/002-adr-monorepo-stack.md`                                | Accepted                                                             |
| 003    | Storage Model                                                              | `plans/archive/003-adr-storage-model.md`                                 | Accepted                                                             |
| 004    | Auth and Access                                                            | `plans/archive/004-adr-auth-and-access.md`                               | Accepted (superseded in part by ADR-092)                             |
| 005    | Offline Sync                                                               | `plans/archive/005-adr-offline-sync.md`                                  | Accepted                                                             |
| 006    | Annotation Model (multi-signal locators)                                   | `plans/archive/006-adr-annotation-model.md`                              | Accepted                                                             |
| 017    | EPUB Engine Migration                                                      | `plans/archive/017-adr-epub-engine-migration.md`                         | Accepted                                                             |
| 021    | Test Infrastructure                                                        | `plans/archive/021-adr-test-infrastructure.md`                           | Accepted                                                             |
| 022    | Coverage and Benchmarking                                                  | `plans/archive/022-adr-coverage-and-benchmarking.md`                     | Accepted                                                             |
| 024    | Warning Management                                                         | `plans/archive/024-adr-warning-management.md`                            | Accepted                                                             |
| 032    | UI/UX 2026                                                                 | `plans/archive/032-adr-ui-ux-2026.md`                                    | Accepted                                                             |
| 034    | ReDoS Hardening                                                            | `plans/archive/034-adr-security-redos-hardening.md`                      | Accepted                                                             |
| 035a   | Content Security Policy (CSP)                                              | `plans/archive/035-adr-content-security-policy.md`                       | Accepted (canonical)                                                 |
| 035b   | Release Governance                                                         | `plans/archive/035-adr-release-governance.md`                            | Accepted (collision — see ADR-083)                                   |
| 037    | Agent Harness Improvement                                                  | `plans/archive/037-adr-agent-harness-improvement-policy.md`              | Accepted                                                             |
| 039    | Issue / PR Triage Policy                                                   | `plans/archive/039-adr-issue-pr-triage-policy.md`                        | Accepted                                                             |
| 043    | Learnings Compaction Policy                                                | `plans/archive/043-adr-learnings-compaction-policy.md`                   | Accepted                                                             |
| 051    | CI Failure Resolution                                                      | `plans/archive/051-adr-ci-failure-resolution.md`                         | Accepted                                                             |
| 052    | Gap Closure Policy                                                         | `plans/archive/052-adr-gap-closure-policy.md`                            | Accepted                                                             |
| 063a   | Accessibility Design Tokens                                                | `plans/archive/063-adr-accessibility-design-tokens.md`                   | Accepted (canonical)                                                 |
| 063b   | Comprehensive Audit Policy                                                 | `plans/archive/063-adr-comprehensive-audit-policy.md`                    | Accepted (collision — see ADR-083)                                   |
| 067    | Observability Adoption & CI Tooling Resilience                             | `plans/archive/067-adr-observability-and-ci-resilience.md`               | Accepted                                                             |
| 068    | Open-Issues Swarm Policy                                                   | `plans/archive/068-adr-open-issues-swarm-policy.md`                      | Accepted (this PR)                                                   |
| 072    | Open PR and Issue Triage Policy                                            | `plans/archive/072-adr-open-pr-issue-triage.md`                          | Active                                                               |
| 073    | SHA Allowlist Governance and Lint Convention Directories                   | `plans/archive/073-adr-sha-governance-lint-conventions.md`               | Accepted                                                             |
| 075    | Tenant Isolation (URL bookId, locator re-validation)                       | `plans/archive/075-adr-tenant-isolation-2026-06-15.md`                   | Accepted (this PR)                                                   |
| 077    | Phased Feature Delivery Policy                                             | `plans/archive/077-adr-phased-feature-delivery.md`                       | Accepted                                                             |
| 078    | Zod Schema Centralization                                                  | `plans/archive/078-adr-zod-schema-centralization.md`                     | Accepted (this PR)                                                   |
| 079    | 2026 Web Platform Standards Adoption                                       | `plans/archive/079-adr-2026-web-platform-standards.md`                   | Accepted                                                             |
| 080    | Session Storage Compensating Controls                                      | `plans/archive/080-adr-session-storage-compensating-controls.md`         | Accepted (this PR)                                                   |
| 081a   | Magic-Link Email Transport                                                 | `plans/archive/081-adr-magic-link-email-transport.md`                    | Accepted (canonical)                                                 |
| 081b   | Pre-Existing Issue Integration Policy                                      | `plans/archive/081-adr-preexisting-issue-integration.md`                 | Accepted (collision — see ADR-083)                                   |
| 082a   | Reader Side-Panel Mutual Exclusivity                                       | `plans/archive/082-adr-reader-side-panel-mutual-exclusivity.md`          | Accepted (canonical)                                                 |
| 082b   | Editorial Minimalist UI Direction                                          | `plans/archive/082-adr-editorial-minimalist-ui-direction.md`             | Accepted (collision — see ADR-083)                                   |
| 083    | ADR Numbering Policy                                                       | `plans/archive/083-adr-adr-numbering-policy.md`                          | Accepted (this PR)                                                   |
| 084    | Comprehensive Open Issues Resolution                                       | `plans/archive/084-adr-comprehensive-open-issues-resolution.md`          | Accepted                                                             |
| 087    | CI Failure Resolution Policy                                               | `plans/archive/087-adr-ci-failure-resolution-policy-2026-06-12.md`       | Accepted                                                             |
| 092    | Token Storage and Feature-Gap Policy                                       | `plans/archive/092-adr-token-storage-and-feature-gap-policy.md`          | Accepted (this PR)                                                   |
| 096    | Merge Order Policy for Multi-Issue Swarms                                  | `plans/archive/096-adr-merge-order-policy-2026-06-15.md`                 | Accepted (this PR)                                                   |
| 102a   | Application Identity and Version Source                                    | `plans/archive/102-adr-app-identity-version-source.md`                   | Accepted (collision — see ADR-083)                                   |
| 102b   | Reading Insights Privacy Boundaries                                        | `plans/archive/102-adr-reading-insights-privacy-boundaries.md`           | Accepted (canonical)                                                 |
| 104    | Product Identity, Naming Convention, and Version Governance                | `plans/archive/104-adr-product-identity-and-version-governance.md`       | Accepted                                                             |
| 105a   | 2026 UI Platform Modernization Policy                                      | `plans/archive/105-adr-2026-ui-platform-modernization.md`                | Accepted                                                             |
| 105b   | Error Handling and Observability Completeness                              | `plans/archive/105-adr-error-handling-and-observability-completeness.md` | Accepted                                                             |
| 106    | Feature Completeness and Incremental Delivery Policy                       | `plans/106-adr-feature-completeness-policy.md`                           | Accepted (plan 113)                                                  |
| 107    | Quality Gate Escalation and DX Standards                                   | `plans/archive/107-adr-quality-dx-standards.md`                          | Accepted (plan 113)                                                  |
| 212    | Risk-First Audit Remediation Policy                                        | `plans/212-adr-risk-first-audit-remediation-policy.md`                   | Accepted                                                             |
| 214    | Audit Recommendation Governance                                            | `plans/214-adr-audit-recommendation-governance.md`                       | Accepted                                                             |
| 215    | Audit Wave 2026-08-03 Execution Policy                                     | `plans/215-adr-audit-wave-2026-08-03-execution-policy.md`                | Accepted                                                             |
| 110    | Backlog Consolidation & Verified-Before-Execution Policy                   | `plans/archive/110-adr-completeness-and-ui-consolidation.md`             | Accepted                                                             |
| 111    | Impeccable Design Vocabulary Adoption                                      | `plans/archive/111-adr-impeccable-design-vocabulary.md`                  | Accepted                                                             |
| 112a   | Phase 2/3 Execution & CI Hardening Policy                                  | `plans/archive/112-adr-phase2-3-execution-policy.md`                     | Accepted                                                             |
| 112b   | Stream Upload & Edge Cache                                                 | `plans/archive/112-adr-stream-upload-edge-cache.md`                      | Accepted                                                             |
| 113    | Phase 3 Polish Execution & Knowledge Compaction Policy                     | `plans/archive/113-adr-phase3-polish-execution-policy.md`                | Accepted                                                             |
| 114    | Comprehensive Audit Remediation Policy (2026-06-27)                        | `plans/archive/114-adr-audit-remediation-policy.md`                      | Accepted                                                             |
| 115    | Verified-Audit Remediation Policy (2026-06-27)                             | `plans/archive/115-adr-verified-audit-remediation-policy.md`             | Accepted (Plan 129)                                                  |
| 120    | Missing-Implementation Verification and Prioritization Policy (2026-07-07) | `plans/archive/120-adr-missing-implementation-prioritization-policy.md`  | Accepted (Clusters 1–9 + F1–F3 shipped via PR #738)                  |
| 123    | CSP `style-src-attr` strategy + self-hosted fonts                          | `plans/archive/123-adr-csp-style-src-attr-and-self-hosted-fonts.md`      | Accepted (PR #748); supersedes the unsafe-inline element of ADR-035a |
| 125    | Markdownlint Enforcement Policy for `plans/`                               | `plans/archive/125-adr-markdownlint-enforcement-policy-plans.md`         | Accepted (Plan 124 / `chore/markdownlint-md058-cleanup`)             |
| 065    | Comprehensive Resolution of Open PRs and Issues                            | `plans/archive/065-adr-tackle-all-open-prs-issues.md`                    | Accepted (Plan 129)                                                  |
| 074    | E2E Testing Accessibility and Environment Resilience                       | `plans/archive/074-adr-e2e-accessibility-resilience.md`                  | Accepted (Plan 129)                                                  |
| 129    | CI Release Readiness and Failure Triage Policy                             | `plans/archive/129-adr-ci-release-readiness-policy.md`                   | Accepted (Plan 129)                                                  |
| 179    | Cloudflare vs Turso Local Development                                      | `plans/archive/179-adr-cloudflare-vs-turso-local-development.md`         | Accepted                                                             |
| 181    | Missing Implementation Triage Policy                                       | `plans/archive/181-adr-missing-implementation-triage-policy.md`          | Accepted                                                             |
| 183    | CI and PR Readiness Policy                                                 | `plans/archive/183-adr-ci-and-pr-readiness-policy.md`                    | Accepted                                                             |
| 185    | Agent Workflow Harness Standards                                           | `plans/archive/185-adr-agent-workflow-harness-standards.md`              | Accepted                                                             |
| 187    | Fail-Closed Engineering Gates                                              | `plans/archive/187-adr-fail-closed-engineering-gates.md`                 | Accepted                                                             |
| 198    | Verified-Closure Methodology                                               | `plans/archive/198-adr-verified-closure-methodology.md`                  | Accepted                                                             |
| 199    | i18n Plural Rules Deferral                                                 | `plans/199-adr-i18n-plural-rules-deferral.md`                            | Accepted (deferred; GOAP-227 follow-up implemented Intl.PluralRules, PR #964) |
| 200    | Login Lockout as Compensating Control for localStorage Token Storage       | `plans/200-adr-session-lockout-compensating-control.md`                  | Accepted (Wave 4-C)                                                  |
| 201    | WebKit in PR smoke CI                                                      | `plans/ADR-201-webkit-smoke-ci.md`                                       | Accepted                                                             |
| 216    | Vitest Pool Policy and Mobile Test Isolation                               | `plans/216-adr-vitest-pool-policy.md`                                    | Accepted                                                             |
| 217    | OpenTelemetry Evaluation as a Follow-Up Decision                           | `plans/217-adr-opentelemetry-evaluation.md`                              | Accepted (deferred evaluation)                                       |
| 218    | Measured Performance Baseline Policy                                       | `plans/218-adr-measured-performance-baseline-policy.md`                  | Accepted (GOAP-218/219 complete)                                     |
| 998    | Offline Comment Status Preservation                                        | `plans/archive/998-adr-offline-comment-status-preservation.md`           | Accepted                                                             |
| 231    | Account Auth Lifecycle             | `plans/231-adr-account-auth-lifecycle-2026.md`         | Accepted (GOAP-230) |
| 232    | Password Reset Token Governance    | `plans/232-adr-password-reset-token-governance.md`     | Accepted (GOAP-230) |
| 233    | Demo Account Sandbox Policy        | `plans/233-adr-demo-account-sandbox-policy.md`         | Accepted (GOAP-230) |
| 234    | Session and Admin Auth Hardening   | `plans/234-adr-session-and-admin-auth-hardening.md`    | Accepted (GOAP-230; items 5+6 passkeys/recovery merged via GOAP-236 with migration 0011; item 7 risk-event handling merged via GOAP-237/PR #977) |

## Proposed

None.

## Cross-referenced (archived GOAP execution records)

| Number | Title                                       | File                                                                                 | Notes         |
| ------ | ------------------------------------------- | ------------------------------------------------------------------------------------ | ------------- |
| 020    | Sprint 141 (GOAP)                           | `plans/archive/020-goap-sprint-141.md`                                               | GOAP, not ADR |
| 023    | Audit Gap Closure (GOAP)                    | `plans/archive/023-audit-gap-closure.md`                                             | GOAP, not ADR |
| 025    | Warning Resolution (GOAP)                   | `plans/archive/025-goap-warning-resolution.md`                                       | GOAP, not ADR |
| 026    | CI/CD Audit and Fix (GOAP)                  | `plans/archive/026-goap-ci-cd-audit-and-fix.md`                                      | GOAP, not ADR |
| 036    | Template AI Agents Improvements (GOAP)      | `plans/archive/036-goap-template-ai-agents-improvements.md`                          | GOAP, not ADR |
| 038    | Backlog Triage 2026-05-19 (GOAP)            | `plans/archive/038-goap-backlog-triage-2026-05-19.md`                                | GOAP, not ADR |
| 040    | Warnings and Issues 2026-05-19 (GOAP)       | `plans/archive/040-goap-warnings-and-issues-2026-05-19.md`                           | GOAP, not ADR |
| 041    | PR-198 Review Feedback Resolution (GOAP)    | `plans/archive/041-goap-pr198-review-feedback-resolution.md`                         | GOAP, not ADR |
| 042    | CI pnpm Fix (GOAP)                          | `plans/archive/042-goap-ci-pnpm-fix.md`                                              | GOAP, not ADR |
| 044    | PR-218 Lighthouse Thresholds (GOAP)         | `plans/archive/044-goap-pr218-lighthouse-thresholds.md`                              | GOAP, not ADR |
| 045    | Batch Resolve Issues 223-225-226-236 (GOAP) | `plans/archive/045-goap-batch-resolve-issues-223-225-226-236-and-prs-232-235-237.md` | GOAP, not ADR |
| 046    | Codebase Optimizations (GOAP)               | `plans/archive/046-goap-codebase-optimizations.md`                                   | GOAP, not ADR |
| 048    | Closeout 2026-05-23 (GOAP)                  | `plans/archive/048-goap-closeout-2026-05-23.md`                                      | GOAP, not ADR |
| 095    | Merge Orchestration (GOAP)                  | `plans/archive/095-goap-merge-orchestration-2026-06-15.md`                           | GOAP, not ADR |
| 226    | Verify-Driven Gap Closure (GOAP)            | `plans/226-goap-verify-gap-closure.md`                                               | COMPLETED: PR #958 |
| 227    | i18n Plural Rules (GOAP)                    | `plans/227-goap-i18n-plural-rules.md`                                                | COMPLETED: PR #964 |
| 228    | Remaining Gaps Closure (GOAP)               | `plans/228-goap-remaining-gaps-closure.md`                                           | COMPLETED: PR #965 |
| 229    | External-URL Hardening (GOAP)               | `plans/229-goap-external-url-hardening.md`                                           | COMPLETED: PR #972 |
| 230    | Account Auth Roadmap (GOAP)                 | `plans/230-goap-account-auth-2026-roadmap.md`   | GOAP, not ADR (implementation complete; A5/A6 passkeys + recovery merged via GOAP-236) |
| 236    | ADR-234 Items 5+6 Review & Merge (GOAP)     | `plans/236-goap-adr234-items56-review-and-merge.md`                                  | Complete: PR #975 |
| 237    | ADR-234 Item 7 Risk-Event Handling (GOAP)   | `plans/237-goap-risk-event-handling.md`                                              | COMPLETED: PR #977 |
| 238    | Docs Drift & Code Cleanup (GOAP)            | `plans/238-goap-docs-drift-and-code-cleanup.md`                                      | This PR |

## Pending

None. The next ADR number is chosen by the next plan author; see ADR-083 for the rule.

## How to add a new ADR

1. Pick the next number per ADR-083.
2. Create `plans/<NNN>-adr-<slug>.md` using the template
   derived from ADR-034 (the cleanest example).
3. Add a row to the **Accepted** table above.
4. Reference the ADR from the relevant plan and the relevant
   `analysis/SWARM_ANALYSIS.md` gap (if any).
5. Open a PR with the ADR + the index update.
