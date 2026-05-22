# Offline Storage and Cache Policy

## Storage Quotas

The application uses Service Worker Cache Storage to provide offline access. The estimated storage usage for common scenarios is as follows:

- **App Shell & Assets:** ~1 MB (precached)
- **Books (EPUBs):** ~2-10 MB per book (cached on demand)
- **Images:** Up to 100 entries, approximately 10-50 MB
- **API Responses:** Up to 50 entries, less than 1 MB

## Eviction Policy

We enforce bounded growth on runtime caches using `workbox-expiration`:

| Cache Name | Max Entries | Max Age | Purpose |
|------------|-------------|---------|---------|
| `epub-files` | 20 | 7 days | EPUB binary files |
| `images` | 100 | 30 days | Book covers and UI images |
| `api-responses` | 50 | 15 minutes | General API data |
| `google-fonts-*` | 10-30 | 1 year | Web fonts |

## Versioning and Updates

Caches are prefixed with `do-epub-v[N]-`. When the Service Worker is updated to a new major version, all caches from previous versions are automatically purged during the `activate` phase to prevent storage bloat and ensure data consistency.

## Sensitive Data

Sensitive API endpoints (e.g., `/api/admin/*`, `/api/access/*`) are explicitly excluded from caching and use a `NetworkOnly` strategy to ensure they are never stored on disk.
