# Skill: Cloudflare Worker API

## Purpose
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
n  comments.ts
  admin.ts
```

## Constraints
- No hardcoded secrets.
- All routes must be typed and validated.
