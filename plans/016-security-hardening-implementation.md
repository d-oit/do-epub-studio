# Plan 016: Security Hardening Implementation

**Status:** Draft  
**Date:** 2026-05-10  
**Related ADR:** ADR-004 (Auth and Access)  
**Trigger:** Security vulnerability audit findings

---

## Executive Summary

Implement all security recommendations from ADR-004 and fix 13 identified vulnerabilities across authentication, authorization, file handling, and rate limiting.

### Critical Issues to Fix
1. **Path traversal vulnerability** in `/api/files/:bookId/:fileKey` endpoint
2. **No rate limiting** on auth endpoints (`/api/access/request`, `/api/admin/login`)
3. **Timing attack potential** on password verification
4. **CORS too permissive** - reflects origin without strict validation

### Medium Priority Issues
5. Generic error messages to prevent enumeration (already implemented)
6. Audit log injection risk - unsanitized payload storage
7. Book ID enumeration via validate permission endpoint
8. Error handling swallows attack indicators

### Low Priority / Best Practices
9. Password complexity enforcement
10. Configurable session timeout (currently hardcoded 7 days)
11. Content-Type validation on file uploads
12. Client-side token storage XSS mitigation

---

## GOAP Decomposition

### Phase 1: Critical Security Fixes (P0)

#### Task 1.1: Path Traversal Prevention
**File:** `apps/worker/src/routes/files.ts`  
**Priority:** P0  
**Dependencies:** None

**Implementation:**
- Add fileKey validation function to reject `..`, null bytes, and other dangerous sequences
- Whitelist allowed characters: alphanumeric, hyphens, underscores, dots, forward slashes
- Validate bookId format (UUID or slug pattern)
- Add unit tests for path traversal attempts

**Acceptance Criteria:**
- [ ] Reject any fileKey containing `..`
- [ ] Reject null bytes (`%00`)
- [ ] Reject backslashes
- [ ] Only allow `[a-zA-Z0-9._/-]` characters
- [ ] Tests pass for malicious inputs

#### Task 1.2: Rate Limiting Implementation
**Files:** 
- `apps/worker/src/lib/rate-limiter.ts` (new)
- `apps/worker/src/routes/access.ts`
- `apps/worker/src/routes/admin-auth.ts`

**Priority:** P0  
**Dependencies:** None

**Implementation:**
- Create KV-based rate limiter with sliding window
- Limit: 5 requests/minute per IP for auth endpoints
- Limit: 10 requests/minute per IP for general API
- Return `429 Too Many Requests` with `Retry-After` header
- Log rate limit violations to audit log

**Acceptance Criteria:**
- [ ] Rate limiter utility created with configurable limits
- [ ] Applied to `/api/access/request` endpoint
- [ ] Applied to `/api/admin/login` endpoint
- [ ] Returns proper 429 status with Retry-After header
- [ ] Unit tests verify rate limiting behavior

#### Task 1.3: Constant-Time Password Comparison
**File:** `apps/worker/src/auth/password.ts`  
**Priority:** P0  
**Dependencies:** None

**Implementation:**
- Use crypto.subtle.timingSafeEqual for hash comparison
- Ensure argon2Verify already uses constant-time comparison
- Add timing-safe string comparison utility

**Acceptance Criteria:**
- [ ] Verify argon2-wasm-edge uses constant-time comparison
- [ ] Add timing-safe comparison utility if needed
- [ ] Document timing attack prevention in security comments

#### Task 1.4: CORS Hardening
**File:** `apps/worker/src/index.ts`  
**Priority:** P0  
**Dependencies:** None

**Implementation:**
- Replace origin reflection with explicit allowlist
- Support multiple allowed origins from env config
- Validate origin against allowlist before setting CORS headers
- Add origin validation logging

**Acceptance Criteria:**
- [ ] CORS_ALLOW_ORIGINS env var supports comma-separated list
- [ ] Origin must match exactly (no wildcards)
- [ ] Invalid origins get default deny
- [ ] Tests verify CORS behavior with valid/invalid origins

---

### Phase 2: Medium Priority Improvements (P1)

#### Task 2.1: Audit Log Sanitization
**File:** `apps/worker/src/audit.ts`  
**Priority:** P1  
**Dependencies:** None

**Implementation:**
- Sanitize payload before storing in audit log
- Remove/nullify sensitive fields (passwords, tokens)
- Limit payload size to prevent DoS
- Validate JSON structure

**Acceptance Criteria:**
- [ ] Payload sanitized of sensitive data
- [ ] Max payload size enforced (e.g., 1KB)
- [ ] Invalid JSON handled gracefully
- [ ] Tests verify sanitization

#### Task 2.2: Enumeration Prevention
**Files:** 
- `apps/worker/src/routes/access.ts`
- `apps/worker/src/auth/password.ts`

**Priority:** P1  
**Dependencies:** Task 1.2 (Rate Limiting)

**Implementation:**
- Ensure generic error messages (already done)
- Add artificial delay to failed auth attempts (100-300ms random)
- Log detailed errors server-side only
- Return identical response structure for all failures

**Acceptance Criteria:**
- [ ] All auth failures return same error message
- [ ] Random delay added to failed attempts
- [ ] Detailed errors logged but not returned to client
- [ ] Tests verify consistent error responses

#### Task 2.3: Error Handling Improvement
**Files:** All route handlers  
**Priority:** P1  
**Dependencies:** None

**Implementation:**
- Add structured error logging with request context
- Include trace ID in error responses
- Log stack traces server-side only
- Add error categorization (client vs server error)

**Acceptance Criteria:**
- [ ] All catch blocks log with context
- [ ] Trace ID included in error responses
- [ ] Stack traces never sent to client
- [ ] Error types properly categorized

---

### Phase 3: Best Practice Enhancements (P2)

#### Task 3.1: Password Complexity Validation
**Files:**
- `apps/worker/src/lib/validation.ts`
- `apps/worker/src/auth/password.ts`

**Priority:** P2  
**Dependencies:** None

**Implementation:**
- Minimum 8 characters (per ADR-004)
- At least 1 uppercase, 1 lowercase, 1 number
- Reject common passwords (top 1000 list)
- Return specific validation errors

**Acceptance Criteria:**
- [ ] Password validation function created
- [ ] Applied to grant creation and admin user creation
- [ ] Clear error messages for each requirement
- [ ] Tests verify validation rules

#### Task 3.2: Configurable Session Timeout
**Files:**
- `apps/worker/src/auth/session.ts`
- `apps/worker/.env.example`

**Priority:** P2  
**Dependencies:** None

**Implementation:**
- Add SESSION_EXPIRY_HOURS env variable (default: 168 hours = 7 days)
- Add SESSION_INACTIVE_TIMEOUT_HOURS env variable (default: 24 hours)
- Update session creation to use configurable values
- Document in .env.example

**Acceptance Criteria:**
- [ ] SESSION_EXPIRY_HOURS configurable
- [ ] SESSION_INACTIVE_TIMEOUT_HOURS configurable
- [ ] Default values match current behavior
- [ ] Environment variables documented

#### Task 3.3: File Upload Content-Type Validation
**File:** `apps/worker/src/routes/books.ts`  
**Priority:** P2  
**Dependencies:** None

**Implementation:**
- Validate Content-Type header matches EPUB MIME types
- Check file magic bytes for EPUB signature
- Reject non-EPUB files with appropriate error
- Log upload attempts with file metadata

**Acceptance Criteria:**
- [ ] Content-Type validated against allowlist
- [ ] Magic byte validation for EPUB files
- [ ] Clear error for invalid file types
- [ ] Upload attempts logged

#### Task 3.4: Client-Side Token Storage Guidance
**Files:**
- `apps/web/src/lib/auth.ts`
- `.agents/AGENTS.md`

**Priority:** P2  
**Dependencies:** None

**Implementation:**
- Document secure token storage patterns
- Recommend httpOnly cookies over localStorage
- Add XSS protection notes to AGENTS.md
- Consider CSRF token implementation

**Acceptance Criteria:**
- [ ] Token storage documented in code comments
- [ ] AGENTS.md updated with security guidance
- [ ] CSRF consideration documented

---

## Implementation Strategy

### Execution Approach: Sequential with Quality Gates

**Phase 1 (Critical):** Complete all P0 tasks before proceeding
- Quality Gate: Security penetration tests pass
- Quality Gate: All new tests pass
- Quality Gate: No regressions in existing auth tests

**Phase 2 (Medium):** Complete after Phase 1 validation
- Quality Gate: Code review by security skill
- Quality Gate: Audit log tests pass

**Phase 3 (Best Practices):** Complete after Phase 2
- Quality Gate: All validation tests pass
- Quality Gate: Documentation updated

---

## Agent Assignments

| Task | Primary Agent | Supporting Skills |
|------|---------------|-------------------|
| 1.1 Path Traversal | security-code-auditor | testing-strategy |
| 1.2 Rate Limiting | cloudflare-worker-api | turso-schema-migrations |
| 1.3 Timing Attack | security-code-auditor | - |
| 1.4 CORS | cloudflare-worker-api | testing-strategy |
| 2.1 Audit Log | cloudflare-worker-api | security-code-auditor |
| 2.2 Enumeration | security-code-auditor | - |
| 2.3 Error Handling | cloudflare-worker-api | code-quality |
| 3.1 Password Validation | secure-invite-and-access | testing-strategy |
| 3.2 Session Timeout | secure-invite-and-access | - |
| 3.3 File Validation | cloudflare-worker-api | security-code-auditor |
| 3.4 Documentation | code-review-assistant | - |

---

## Testing Strategy

### Unit Tests Required
- Path traversal attempt detection
- Rate limiting behavior (under/over limit)
- CORS origin validation
- Password complexity validation
- Audit log sanitization

### Integration Tests Required
- Full auth flow with rate limiting
- File download with malicious paths
- Session expiration behavior
- Admin login with invalid credentials

### Security Tests Required
- OWASP Top 10 scan
- Penetration testing on file endpoints
- Timing attack analysis
- CORS misconfiguration tests

---

## Acceptance Criteria (Overall)

### Security Requirements
- [ ] All critical vulnerabilities fixed
- [ ] Rate limiting active on auth endpoints
- [ ] Path traversal attacks blocked
- [ ] CORS properly restricted
- [ ] Audit logs sanitized

### Quality Requirements
- [ ] 100% test coverage on new code
- [ ] All existing tests still pass
- [ ] No performance degradation (>10%)
- [ ] Documentation updated

### Compliance Requirements
- [ ] ADR-004 security rules implemented
- [ ] OWASP Top 10 addressed
- [ ] Security checklist updated

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Rate limiting breaks legitimate users | High | Start with lenient limits, monitor, adjust |
| Path validation breaks valid files | Medium | Test with real file keys first |
| CORS changes break frontend | High | Test in staging with actual frontend |
| Password validation locks out users | Medium | Apply only to new passwords |

---

## Rollout Plan

### Stage 1: Development
- Implement all fixes
- Run full test suite
- Security code review

### Stage 2: Staging
- Deploy to staging environment
- Run penetration tests
- Monitor for false positives

### Stage 3: Production
- Deploy behind feature flag (if applicable)
- Gradual rollout (10%, 50%, 100%)
- Monitor error rates and auth failures

---

## References

- ADR-004: Auth and Access (`plans/004-adr-auth-and-access.md`)
- Security Code Auditor Skill (`.agents/skills/security-code-auditor/SKILL.md`)
- OWASP Top 10 (`.agents/skills/security-code-auditor/references/owasp-top10.md`)
- Security Checklist (`.agents/skills/security-code-auditor/references/security-checklist.md`)

---

## Next Steps

1. Review and approve this plan
2. Begin Phase 1 implementation (Critical fixes)
3. Schedule security review after Phase 1
4. Proceed to Phases 2-3 based on priority
