# OWASP Top 10 for EPUB Studio

Adapted from OWASP Top 10 2021 for EPUB reading application context.

## A01:2021 Broken Access Control

**EPUB Context**: Users accessing books they don't have permissions for.

### Prevention

- Deny by default
- Implement access control once, reuse throughout
- Model accesses and record sharing in DB
- Disable directory listing on file servers

```typescript
// GOOD: Check permission before access
async function getBookContent(bookId: string, userId: string) {
  const hasAccess = await db.checkPermission(userId, bookId);
  if (!hasAccess) throw new ForbiddenError();
  return fetchBook(bookId);
}
```

## A02:2021 Cryptographic Failures

**EPUB Context**: Storing book content insecurely, exposing signing secrets.

### Prevention

- Encrypt offline data at rest
- Use secure random for tokens
- Don't hardcode encryption keys
- Use TLS for all connections

## A03:2021 Injection

**EPUB Context**: Malicious EPUB files with embedded scripts.

### Prevention

- Sanitize all HTML from EPUB before rendering
- Block external resource loading
- Validate EPUB structure

```typescript
// GOOD: Sanitize EPUB HTML
import DOMPurify from 'dompurify';
const safeHtml = DOMPurify.sanitize(rawEpubHtml, {
  ALLOWED_TAGS: ['p', 'span', 'div', 'h1', 'h2', 'h3', 'a', 'img', 'ul', 'ol', 'li'],
  ALLOWED_ATTR: ['class', 'href', 'src', 'alt', 'title'],
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'link', 'style'],
});
```

## A04:2021 Insecure Design

**EPUB Context**: Weak offline sync leading to conflicts.

### Prevention

- Use threat modeling
- Separate read/write permissions
- Implement conflict resolution strategy
- Log access decisions

## A05:2021 Security Misconfiguration

**EPUB Context**: Exposing Turso credentials, weak CORS.

### Prevention

- Hardened runtime configuration
- CORS restricted to known origins
- Security headers on all responses
- Error messages don't expose stack traces

## A06:2021 Vulnerable Components

**EPUB Context**: Outdated EPUB parsing libraries.

### Prevention

- Remove unused dependencies
- Monitor for CVEs in dependencies
- Use only official EPUB parsing libraries

## A07:2021 Auth Failures

**EPUB Context**: Session hijacking, weak session tokens.

### Prevention

- Short session timeouts
- Rotate session tokens on privilege change
- Implement proper logout

## A08:2021 Software Integrity

**EPUB Context**: Malicious EPUB files, tampered offline cache.

### Prevention

- Verify EPUB integrity on download
- Use content-addressable storage
- Validate checksums

## A09:2021 Security Logging Failures

**EPUB Context**: Missing audit trail for permission changes.

### Prevention

- Log all access attempts
- Include user ID, timestamp, resource
- Alert on suspicious patterns

## A10:2021 SSRF

**EPUB Context**: EPUB links to external URLs.

### Prevention

- Block external URLs in EPUB
- Use allowlists for resources
- Disable redirect following
