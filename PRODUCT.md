# Product: d.o.EPUB Studio

## What it is

A self-hosted EPUB reading platform with admin management, offline PWA support, and a modern web UI. Users upload EPUBs, read them in a browser-based reader, annotate (highlights, comments, bookmarks), track reading insights, and manage their library — all with full offline capability.

## Audience

- **Primary:** Individual readers / small teams who want a private, self-hosted alternative to commercial EPUB readers
- **Secondary:** Admins who manage the catalog, user grants, and server configuration

## Brand / Product Lane

- **Lane:** Product (app UI, dashboard, tool)
- **Tone:** Editorial, minimalist, premium — like a well-designed book app, not a SaaS dashboard
- **Voice:** Calm, direct, no marketing fluff

## Core Flows

1. Login (book-scoped email + password) → open book → read
2. Annotate: highlight text, add comments, bookmark locations
3. View reading insights (active reading time, pages read per day, current streak, estimated time to finish)
4. Admin: manage books, grants, audit logs
5. Offline: queue annotations, sync when online

Ordinary login is the email + password form on `/login` (posting to
`/api/access/request` with the book slug), not a magic-link flow. Two
supporting flows are separate from the core ones above:

- **Account recovery** — request a reset link (`/api/access/recovery-request`),
  then set a new password via the token link (`/api/access/verify-recovery`).
- **Book invitations** — an admin invites a reader or creator to one book and
  the invitee accepts a one-time link (ADR-284); those invitation/recovery
  links are the only magic-link surfaces.

## Anti-References

- No SaaS dashboard aesthetic (purple gradients, nested cards, gray text on color)
- No Inter/system font for everything — use a considered type scale
- No bounce/elastic easing (feels dated)
- No generic "AI slop" design patterns
