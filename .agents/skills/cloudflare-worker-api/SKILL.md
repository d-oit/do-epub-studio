---
version: "1.0.0"
name: cloudflare-worker-api
description: Design Cloudflare Worker API routes with typed handlers, auth middleware, and signed URL generation. Use when creating Worker endpoints, implementing session validation, or designing secure file access patterns.
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
