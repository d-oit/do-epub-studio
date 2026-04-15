# E2E Test Plan v1.0 - Complete Coverage

**Status**: Active  
**Version**: 1.0.0  
**Last Updated**: 2026-04-14  
**Scope**: Web Application, Admin Portal, Reader

## Overview

This document provides comprehensive E2E test specifications including edge cases, failure scenarios, and regression prevention tests.

## Test Infrastructure

### Framework
- **Primary**: Playwright
- **Browser Matrix**: Chromium, Firefox, WebKit
- **Viewport Matrix**: Mobile (375x667), Tablet (768x1024), Desktop (1280x720)

### Test Data
```typescript
// Test credentials (do not commit real credentials)
const TEST_USER = {
  bookSlug: 'test-book',
  email: 'test@example.com',
  password: 'test-password-123',
};

const TEST_ADMIN = {
  email: 'admin@example.com',
  password: 'admin-password-456',
};
```

## 1. Authentication Flow Tests

### 1.1 Login Success Flow

| Test ID | Description | Steps | Expected Result |
|---------|-------------|-------|-----------------|
| AUTH-001 | Valid credentials login | 1. Navigate to login<br>2. Enter valid bookSlug, email, password<br>3. Click submit | Redirected to reader |
| AUTH-002 | OAuth login | 1. Click "Login with Google"<br>2. Complete OAuth flow | Redirected to reader with valid session |

### 1.2 Login Failure Flows

| Test ID | Description | Steps | Expected Result |
|---------|-------------|-------|-----------------|
| AUTH-101 | Invalid book slug | 1. Enter invalid bookSlug<br>2. Submit | Error: Book not found |
| AUTH-102 | Wrong password | 1. Enter wrong password<br>2. Submit | Error: Invalid credentials |
| AUTH-103 | SQL injection attempt | Enter SQL in fields | Sanitized, graceful failure |
| AUTH-104 | XSS attempt | Enter script in fields | Escaped, no execution |
| AUTH-105 | Rate limiting | 10 failed attempts | Account temporarily locked |

### 1.3 Session Management

| Test ID | Description | Steps | Expected Result |
|---------|-------------|-------|-----------------|
| AUTH-201 | Session expiration | Wait for token expiry | Redirected to login |
| AUTH-202 | Session revocation | Admin revokes access | Access revoked message |
| AUTH-203 | Logout functionality | Click logout | Session cleared |

## 2. Reader Experience Tests

### 2.1 Book Loading

| Test ID | Description | Steps | Expected Result |
|---------|-------------|-------|-----------------|
| READER-001 | Successful load | 1. Login<br>2. Open reader | Content displays |
| READER-002 | Large EPUB handling | Open 50MB+ EPUB | Smooth navigation |
| READER-003 | Corrupted EPUB | Open corrupted file | Graceful error message |
| READER-004 | Slow loading | Throttle network | Skeleton UI shown |

### 2.2 Navigation

| Test ID | Description | Steps | Expected Result |
|---------|-------------|-------|-----------------|
| READER-101 | TOC navigation | Click TOC item | Jump to chapter |
| READER-102 | Progress persistence | Read, logout, login back | Return to position |

### 2.3 Typography

| Test ID | Description | Steps | Expected Result |
|---------|-------------|-------|-----------------|
| READER-201 | Theme switching | Switch light/dark/sepia | Theme applies |
| READER-202 | Font size adjustment | Change font sizes | Smooth scaling |
| READER-203 | Font family change | Switch fonts | Font changes |

### 2.4 Annotations

| Test ID | Description | Steps | Expected Result |
|---------|-------------|-------|-----------------|
| ANNOT-001 | Create highlight | Select text, highlight | Highlight saved |
| ANNOT-002 | Delete highlight | Click delete | Highlight removed |
| ANNOT-003 | Create comment | Select text, comment | Comment saved |
| ANNOT-004 | Offline annotations | Create offline, sync later | Synced on reconnect |

## 3. Admin Portal Tests

### 3.1 Book Management

| Test ID | Description | Steps | Expected Result |
|---------|-------------|-------|-----------------|
| ADMIN-001 | Create book | 1. Click create<br>2. Fill form<br>3. Upload EPUB | Book created |
| ADMIN-002 | Delete book | Click delete, confirm | Book removed |
| ADMIN-003 | Update book metadata | Edit title, author | Changes saved |
| ADMIN-004 | Large file upload | Upload 100MB+ EPUB | Progress shown, success |

### 3.2 Access Grants

| Test ID | Description | Steps | Expected Result |
|---------|-------------|-------|-----------------|
| GRANT-001 | Create access grant | Add email, set permissions | Grant created |
| GRANT-002 | Revoke access | Click revoke | Access immediately revoked |
| GRANT-003 | Modify permissions | Change capabilities | Permissions updated |

### 3.3 Audit Log

| Test ID | Description | Steps | Expected Result |
|---------|-------------|-------|-----------------|
| AUDIT-001 | View audit log | Navigate to audit page | Log entries displayed |
| AUDIT-002 | Filter by date | Select date range | Filtered results |
| AUDIT-003 | Export audit log | Click export | CSV download started |

## 4. Offline Functionality Tests

### 4.1 Offline Reading

| Test ID | Description | Steps | Expected Result |
|---------|-------------|-------|-----------------|
| OFFLINE-001 | Download for offline | Click download button | Book cached locally |
| OFFLINE-002 | Read while offline | Disconnect, open book | Book readable |
| OFFLINE-003 | Sync on reconnect | Make changes offline, reconnect | Changes synced |

### 4.2 Offline Annotations

| Test ID | Description | Steps | Expected Result |
|---------|-------------|-------|-----------------|
| OFFLINE-101 | Create highlight offline | Disconnect, create highlight | Stored locally |
| OFFLINE-102 | Sync annotations | Reconnect | Highlights synced to server |
| OFFLINE-103 | Conflict resolution | Edit same annotation offline/online | Conflict handled gracefully |

## 5. Responsive Design Tests

### 5.1 Mobile

| Test ID | Description | Steps | Expected Result |
|---------|-------------|-------|-----------------|
| RESP-001 | Mobile login | View on 375px width | Form readable, usable |
| RESP-002 | Mobile reader | Open book on mobile | Readable, swipe navigation |
| RESP-003 | Mobile admin | Open admin on mobile | Layout adapts, usable |

### 5.2 Tablet

| Test ID | Description | Steps | Expected Result |
|---------|-------------|-------|-----------------|
| RESP-101 | Tablet layout | View on 768px width | Optimized layout |
| RESP-102 | Touch interactions | Tap, swipe | Responsive to touch |

## 6. Accessibility Tests

### 6.1 Keyboard Navigation

| Test ID | Description | Steps | Expected Result |
|---------|-------------|-------|-----------------|
| A11Y-001 | Tab navigation | Press Tab through UI | All elements focusable |
| A11Y-002 | Enter activation | Focus button, press Enter | Action triggered |
| A11Y-003 | Escape dismissal | Open modal, press Escape | Modal closes |

### 6.2 Screen Reader

| Test ID | Description | Steps | Expected Result |
|---------|-------------|-------|-----------------|
| A11Y-101 | Button labels | Check with screen reader | All buttons labeled |
| A11Y-102 | Form labels | Check form fields | All inputs labeled |
| A11Y-103 | Live regions | Trigger async action | Status announced |

### 6.3 Visual

| Test ID | Description | Steps | Expected Result |
|---------|-------------|-------|-----------------|
| A11Y-201 | Color contrast | Run contrast checker | WCAG AA compliance |
| A11Y-202 | Focus indicators | Tab through UI | Focus visible |
| A11Y-203 | Reduced motion | Enable prefers-reduced-motion | Animations disabled |

## 7. Performance Tests

### 7.1 Load Performance

| Test ID | Description | Steps | Expected Result |
|---------|-------------|-------|-----------------|
| PERF-001 | First contentful paint | Measure load time | Less than 1.5s |
| PERF-002 | Time to interactive | Measure TTI | Less than 3.5s |
| PERF-003 | Largest contentful paint | Measure LCP | Less than 2.5s |

### 7.2 Runtime Performance

| Test ID | Description | Steps | Expected Result |
|---------|-------------|-------|-----------------|
| PERF-101 | Scroll performance | Scroll through book | 60fps maintained |
| PERF-102 | Animation smoothness | Trigger animations | No jank |
| PERF-103 | Memory usage | Monitor memory | No leaks detected |

## 8. Security Tests

### 8.1 Input Validation

| Test ID | Description | Steps | Expected Result |
|---------|-------------|-------|-----------------|
| SEC-001 | File type validation | Upload non-EPUB file | Rejected with error |
| SEC-002 | File size limits | Upload oversized file | Rejected gracefully |
| SEC-003 | CSRF protection | Attempt CSRF attack | Request blocked |

### 8.2 Authorization

| Test ID | Description | Steps | Expected Result |
|---------|-------------|-------|-----------------|
| SEC-101 | Access unauthorized book | Attempt to access without grant | Access denied |
| SEC-102 | Privilege escalation | Attempt admin actions as user | Actions blocked |
| SEC-103 | Token tampering | Modify JWT token | Request rejected |

## 9. Edge Cases & Stress Tests

### 9.1 Data Edge Cases

| Test ID | Description | Steps | Expected Result |
|---------|-------------|-------|-----------------|
| EDGE-001 | Empty book | Open book with no content | Graceful empty state |
| EDGE-002 | Very long chapter | Open chapter with 100k+ words | Renders without crash |
| EDGE-003 | Special characters | Book with unicode/special chars | Renders correctly |
| EDGE-004 | Large annotation count | 1000+ annotations | Performance acceptable |

### 9.2 Network Edge Cases

| Test ID | Description | Steps | Expected Result |
|---------|-------------|-------|-----------------|
| EDGE-101 | Intermittent connection | Toggle network on/off | Graceful handling |
| EDGE-102 | Very slow connection | Throttle to 2G | Loading states shown |
| EDGE-103 | Connection drop mid-action | Drop during upload | Retry option provided |

### 9.3 Browser Edge Cases

| Test ID | Description | Steps | Expected Result |
|---------|-------------|-------|-----------------|
| EDGE-201 | Private browsing | Test in incognito mode | Works normally |
| EDGE-202 | Disabled cookies | Disable cookies | Clear error message |
| EDGE-203 | Disabled JavaScript | Disable JS | Graceful degradation |

## 10. Regression Prevention

### 10.1 Visual Regression

| Test ID | Description | Steps | Expected Result |
|---------|-------------|-------|-----------------|
| VREG-001 | Login page unchanged | Compare screenshots | Pixel-perfect match |
| VREG-002 | Reader layout unchanged | Compare screenshots | Pixel-perfect match |
| VREG-003 | Admin cards unchanged | Compare screenshots | Pixel-perfect match |

### 10.2 Functional Regression

| Test ID | Description | Steps | Expected Result |
|---------|-------------|-------|-----------------|
| FREG-001 | Core user flow | Full login to reading flow | Works as before |
| FREG-002 | Admin operations | Full CRUD operations | Works as before |
| FREG-003 | Offline sync | Full offline then online flow | Works as before |

## Test Execution Schedule

### Continuous (Every Commit)
- AUTH-001, AUTH-101, AUTH-102
- READER-001, READER-101
- ADMIN-001
- All accessibility tests

### Daily
- All authentication tests
- All reader tests
- All performance tests

### Weekly
- All edge cases
- Security tests
- Regression tests

### Before Release
- Full test suite
- Cross-browser testing
- Mobile device testing

## Success Criteria

- 100% of critical path tests pass
- 95% of all tests pass
- No accessibility violations
- Performance metrics within targets
- Zero security vulnerabilities
