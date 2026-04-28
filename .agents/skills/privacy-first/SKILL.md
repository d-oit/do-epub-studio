do-epub-studio/.agents/skills/privacy-first/SKILL.md
```

---
version: "1.0.0"
name: privacy-first
description: >
  Prevent email addresses and personal data from entering the codebase. Activate when
  user asks to "prevent emails", "remove personal data", "privacy check", "no email",
  or when writing/editing any code, config, or documentation files.
category: security
allowed-tools: Read Write Edit Grep Glob
license: MIT
---

# Privacy-First Skill

Prevent personal data, email addresses, and sensitive information from entering the codebase.

## When to Use

- Writing new code that handles user data
- Creating configuration files
- Writing documentation or comments
- Adding test data
- Processing form inputs
- Database schema design

## Core Principle

**Never commit personal data to version control.** Once data enters the repo, it stays in history.

## Common PII Patterns to Block

### Email Addresses

```javascript
// BAD - Real email in code
const adminEmail = "john.doe@company.com";

// BAD - In comments
// Contact: sarah@personal-email.com

// BAD - In config
{
  "admin": "mary@example.com"
}

// GOOD - Use environment variables
const adminEmail = process.env.ADMIN_EMAIL;

// GOOD - Use placeholders
const adminEmail = "admin@example.com";
```

### Phone Numbers

```javascript
// BAD
const phone = "+1-555-123-4567";

// GOOD
const phone = "+1-555-000-0000";
```

### Names (Real)

```javascript
// BAD - Real names in code
const user = "John Smith";

// GOOD - Generic
const user = "John Doe";
```

### Addresses

```javascript
// BAD
const address = "123 Main Street, New York, NY 10001";

// GOOD
const address = "123 Fake Street, Springfield, IL 62704";
```

### API Keys / Tokens

```javascript
// BAD - Real credentials
const apiKey = "sk_live_abc123xyz";

// GOOD - Use secrets management
const apiKey = process.env.API_KEY;
```

### Social Security Numbers

```javascript
// NEVER
const ssn = "123-45-6789";
```

## Prevention Strategies

### 1. Git Pre-commit Hooks

```bash
# Add to .git/hooks/pre-commit
#!/bin/bash
# Block emails in commits

if git diff --cached | grep -E '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'; then
  echo "ERROR: Possible email address found in commit"
  exit 1
fi
```

### 2. Gitleaks Configuration

```toml
# .gitleaks.toml
[[rules]]
  description = "Email"
  regex = '''[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'''

[[rules]]
  description = "AWS Key"
  regex = '''(A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}'''

[[rules]]
  description = "GitHub Token"
  regex = '''gh[pousr]_[A-Za-z0-9_]{36,251}'''
```

### 3. ESLint Rules

```javascript
// .eslintrc.js
module.exports = {
  rules: {
    'no-restricted-patterns': [
      'error',
      {
        patterns: [
          {
            // Block obvious email patterns
            pattern: '/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}/',
            message: 'Do not commit email addresses'
          }
        ]
      }
    ]
  }
};
```

### 4. IDE Extensions

- GitLens (shows commit history)
- Pre-commit hook warnings
- Secret scanning alerts

## Test Data Guidelines

### Use Fake Data

```javascript
// BAD - Real-looking but fake
const user = {
  name: "John Smith",
  email: "john.smith@real-company.com"
};

// GOOD - Obviously fake
const user = {
  name: "John Doe",
  email: "john.doe@example.com"
};

// BETTER - Use faker library
import { faker } from '@faker-js/faker';

const user = {
  name: faker.person.fullName(),
  email: faker.internet.email()
};
```

### Safe Test Fixtures

```javascript
// Use these patterns
const testUser = {
  email: 'user@example.com',
  name: 'Test User',
  phone: '+1-555-000-0000',
  address: '123 Test Street, Test City, TS 12345'
};

// Not these
const testUser = {
  email: 'real@company.com',  // Real domain
  phone: '+1-555-123-4567',   // Real-looking number
  ssn: '123-45-6789'          // Never
};
```

## Documentation Rules

### Don't Include Real Data

```markdown
<!-- BAD -->
## Contact
John Smith
john.smith@company.com
555-123-4567

<!-- GOOD -->
## Contact
support@example.com
```

### Use Placeholders

```markdown
<!-- BAD -->
For help, contact admin@yourcompany.com

<!-- GOOD -->
For help, contact [support email]
```

### API Examples

```javascript
// BAD - Real domain
fetch('https://api.production-service.com/data')

// GOOD - Example domain
fetch('https://api.example.com/data')
```

## Database Schema

### Mask Sensitive Fields

```sql
-- Always mask in logs/exports
SELECT 
  id,
  email,           -- Full email visible
  LEFT(email, 2) || '***@***.***' AS email_masked,
  phone,
  CONCAT('***-***-', RIGHT(phone, 4)) AS phone_masked
FROM users;
```

### Use Pseudonymization

```sql
-- For development, use fake data
-- Never use production data dumps in dev
```

## Error Handling

### Don't Leak User Info

```javascript
// BAD - Exposes user email in errors
throw new Error(`User ${user.email} not found`);

// GOOD - Generic error
throw new Error('User not found');

// GOOD - Log internally, generic to user
logger.error(`User lookup failed for ID: ${userId}`);
throw new Error('User not found');
```

## Configuration Files

### Environment Variables

```bash
# .env.example (safe to commit)
DATABASE_URL=
API_KEY=
SECRET_KEY=

# .env (never commit)
DATABASE_URL=postgres://user:pass@localhost/db
API_KEY=sk_live_xxx
SECRET_KEY=xxx
```

### Config Templates

```json
// config.example.json (safe)
{
  "apiUrl": "https://api.example.com",
  "timeout": 30000
}

// config.json (in .gitignore)
{
  "apiUrl": "https://api.real-service.com",
  "apiKey": "sk_live_xxx"
}
```

## EPUB Studio Specific

### User Data Handling

- Never log full email addresses
- Mask user identifiers in analytics
- Use pseudonyms in bug reports
- Anonymize user-created content for testing

### Annotations

```javascript
// BAD - Real CFI with user info
const highlight = {
  cfi: "epubcfi(/6/4[chap01]!/4/2/1:45)",
  userId: "user_12345"  // Could be traced
};

// GOOD - Anonymized
const highlight = {
  cfi: "epubcfi(/6/4[chap01]!/4/2/1:45)",
  userId: "test_user"  // Generic
};
```

## Quick Reference

| Pattern | Block | Replace With |
|---------|-------|--------------|
| Email | ❌ | `user@example.com` |
| Phone | ❌ | `+1-555-000-0000` |
| Name | ❌ | `John Doe` |
| Address | ❌ | `123 Fake St` |
| API Key | ❌ | `process.env.API_KEY` |
| SSN | ❌ | Never |
| Real domain | ❌ | `example.com` |

## Integration

- **security-code-auditor**: Use for security reviews
- **testdata-builders**: Use for safe test data
- **code-quality**: Add PII checks to lint

## Quality Checklist

- [ ] No email addresses in code
- [ ] No real names in code/comments
- [ ] No phone numbers in code
- [ ] No API keys in code
- [ ] Environment variables for secrets
- [ ] .gitignore excludes .env
- [ ] Test data uses faker or placeholders
- [ ] Error messages don't leak PII
- [ ] Gitleaks or pre-commit hooks in place

## Summary

Privacy-first means assuming all code will be public. Never commit personal data, use environment variables for secrets, and use fake data in tests. Prevention is easier than cleanup.