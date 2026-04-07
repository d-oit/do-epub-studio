# EPUB Studio Security Audit Checklist

## Authentication & Authorization

- [ ] Password hashing uses strong KDF (Argon2, bcrypt)
- [ ] Session tokens are cryptographically secure
- [ ] Sessions revoke on permission changes
- [ ] No user enumeration in auth responses
- [ ] Rate limiting on auth endpoints
- [ ] Secure password reset flow

## EPUB Handling

- [ ] File type validation on upload (magic bytes, not extension)
- [ ] File size limits enforced
- [ ] HTML content sanitized before rendering
- [ ] No `eval()` or `new Function()` with user content
- [ ] External resource loading blocked in EPUB

## API Security

- [ ] All endpoints require authentication
- [ ] Permission checks on every protected endpoint
- [ ] Input validation with Zod schemas
- [ ] No SQL injection (use parameterized queries)
- [ ] CORS properly configured
- [ ] Security headers present (CSP, HSTS, etc.)

## Data Protection

- [ ] Turso auth tokens never exposed to client
- [ ] Signed URLs expire appropriately
- [ ] Offline data encrypted at rest
- [ ] Audit logs for sensitive operations
- [ ] No secrets in source code

## Reference: Common Vulnerabilities

### A1: Injection
```typescript
// BAD
db.query(`SELECT * FROM books WHERE id = ${userId}`);

// GOOD
db.query('SELECT * FROM books WHERE id = ?', [userId]);
```

### A2: Broken Auth
```typescript
// BAD - no session check
async function getBook(id: string) {
  return db.getBook(id);
}

// GOOD - with auth check
async function getBook(id: string, session: Session) {
  await validateAccess(session, id);
  return db.getBook(id);
}
```

### A3: XSS in EPUB
```typescript
// BAD
container.innerHTML = epubContent;

// GOOD
import DOMPurify from 'isomorphic-dompurify';
container.innerHTML = DOMPurify.sanitize(epubContent);
```
