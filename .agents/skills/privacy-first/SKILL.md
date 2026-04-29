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

### Git Pre-commit Hooks

```bash
#!/bin/bash
# Block emails in commits
if git diff --cached | grep -E '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'; then
  echo "ERROR: Possible email address found in commit"
  exit 1
fi
```

### Gitleaks Configuration

```toml
# .gitleaks.toml
[[rules]]
  description = "Email"
  regex = '''[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'''

[[rules]]
  description = "AWS Key"
  regex = '''(A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}'''
```

### ESLint Rules

```javascript
// .eslintrc.js
module.exports = {
  rules: {
    'no-restricted-patterns': [
      'error',
      {
        patterns: [{
          pattern: '/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}/',
          message: 'Do not commit email addresses'
        }]
      }
    ]
  }
};
```

## Test Data Guidelines

### Use Fake Data

```javascript
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
const testUser = {
  email: 'user@example.com',
  name: 'Test User',
  phone: '+1-555-000-0000',
  address: '123 Test Street, Test City, TS 12345'
};
```

## Documentation Rules

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
SELECT 
  id,
  LEFT(email, 2) || '***@***.***' AS email_masked,
  CONCAT('***-***-', RIGHT(phone, 4)) AS phone_masked
FROM users;
```

## Error Handling

### Don't Leak User Info

```javascript
// BAD - Exposes user email in errors
throw new Error(`User ${user.email} not found`);

// GOOD - Generic error
throw new Error('User not found');
```

## Summary

Privacy-first means assuming all code will be public. Never commit personal data and use environment variables for secrets.
