---
version: "1.0.0"
name: cloudflare-worker-api
description: >
  Structure Worker API routes and handlers. Activate for route definition,
  response helpers, and typed handler patterns. Auth belongs to secure-invite-and-access.
category: workflow
allowed-tools: Read Write Edit Grep Glob
license: MIT
---

# Cloudflare Worker API

Provide a standardized structure for Worker routes, auth middleware, and response helpers.

## Key Responsibilities

- Define API routes and handlers.
- Implement auth middleware and session validation.
- Provide response helpers for consistent API responses.
- Design signed URL endpoints for secure file access.

## Interface Example

```ts
// Example route file structure
src/routes/
  access.ts
  books.ts
  comments.ts
  admin.ts
```

## Constraints

- No hardcoded secrets.
- All routes must be typed and validated.
- Use Zod for input validation.
- All responses must follow consistent format.
