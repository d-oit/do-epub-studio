---
name: security-code-auditor
description: Perform security audits on EPUB Studio code to identify vulnerabilities. Use when auditing authentication, authorization, EPUB parsing, signed URLs, or offline sync security.
license: MIT
---

# Security Code Auditor

Perform security audits on EPUB Studio code, focusing on the project's specific security requirements.

## EPUB Studio Security Scope

### Critical Areas to Audit
- **Authentication**: Password hashing, session management, token generation
- **Authorization**: Permission grants, access validation, session revocation
- **EPUB Handling**: HTML sanitization, content extraction, file validation
- **Signed URLs**: Expiration, scope validation, URL generation
- **Offline Sync**: Conflict resolution, data integrity, cache security

### Excluded from Scope
- Network penetration testing
- Social engineering
- Physical security

## Audit Workflow

### 1. Identify Attack Surface
```
1. Authentication endpoints (/api/auth/*)
2. Book access endpoints (/api/books/*)
3. EPUB parsing (apps/web/lib/epub/)
4. Offline storage (IndexedDB, Service Workers)
```

### 2. Static Analysis Checklist
- [ ] SQL/NoSQL injection in database queries
- [ ] Command injection in file processing
- [ ] Insecure deserialization
- [ ] Hardcoded secrets or credentials
- [ ] Insufficient input validation
- [ ] Missing authorization checks

### 3. EPUB Security
```typescript
// BAD: Unsafe innerHTML
element.innerHTML = epubContent;

// GOOD: Sanitize before rendering
import DOMPurify from 'isomorphic-dompurify';
const clean = DOMPurify.sanitize(epubContent, {
  ALLOWED_TAGS: ['p', 'span', 'div', 'a'],
  ALLOWED_ATTR: ['class', 'href']
});
```

### 4. Configuration Review
- [ ] CORS policies for API endpoints
- [ ] Security headers (CSP, HSTS)
- [ ] Turso auth token exposure
- [ ] Cloudflare R2 credentials
- [ ] Session timeout settings

## EPUB Studio Anti-Patterns

### Hardcoded Secrets
```typescript
// BAD
const API_KEY = 'sk-live-abc123';

// GOOD
const API_KEY = process.env.EPUB_API_KEY;
```

### Unsafe EPUB HTML
```typescript
// BAD - XSS vulnerability
document.write(epubHtmlContent);

// GOOD - Use DOMPurify
import sanitize from 'dompurify';
const safe = sanitize(rawContent, { RETURN_TRUSTED_TYPE: false });
```

### Public File URLs
```typescript
// BAD - Direct public URL
return `https://bucket.r2.dev/${bookId}`;

// GOOD - Signed URL with expiration
return generateSignedUrl(bookId, { expiresIn: '15m' });
```

## Vulnerability Severity

| Level | Examples | Response |
|-------|----------|----------|
| Critical | RCE, Auth bypass | Immediate fix |
| High | Data exposure, Privilege escalation | 24 hours |
| Medium | Information disclosure | 1 week |
| Low | Best practice | Next sprint |

## Security Rules for EPUB Studio

1. Never expose Turso auth tokens to frontend
2. Always validate signed URLs server-side
3. Sanitize all EPUB HTML content
4. Validate EPUB file type/size on upload
5. Log all permission changes
6. Hash passwords with Argon2 or bcrypt
7. Revoke sessions immediately on permission revocation

## References

- `references/security-checklist.md` - Audit checklist
- `references/owasp-top10.md` - OWASP guidelines adapted for EPUB
