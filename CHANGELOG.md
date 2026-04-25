# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-04-25

### Added
- **Initial Baseline Release**
- **EPUB Reader**: Integrated EPUB.js for high-fidelity rendering in the browser.
- **Access Control**: Role-based access control (admin, editor, reader) with email-gated grants and optional password protection.
- **Offline Support**: PWA capability with IndexedDB and Service Worker for offline reading and progress sync.
- **Editorial Workspace**: Support for bookmarks, highlights, and threaded comments for editorial review.
- **Audit Logging**: Comprehensive tracking of access, comments, and administrative actions.
- **Monorepo Architecture**: Modern stack with Vite, Cloudflare Workers, Turso (libSQL), and R2 storage.
- **Quality Infrastructure**: Robust CI/CD with Vitest, Playwright, Axe accessibility audits, and automated quality gates.
- **Release Workflow**: Defined automated release process using GitHub Actions and `workflow_dispatch`.

### Changed
- Switched to process-level isolation in Vitest to resolve React 18 concurrency issues.
- Optimized reanchoring performance for highlights and comments.

### Fixed
- Resolved CI bootstrap failures related to pnpm and toolchain version mismatches.
- Fixed 401/403 interceptors for automatic session expiry handling.
