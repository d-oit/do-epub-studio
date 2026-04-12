---
description: GitHub Actions workflow commands
subtask: true
---

# GitHub Actions workflow commands

## CI Workflow

The project uses GitHub Actions for CI/CD.

### Running CI Locally

Before pushing, run quality gate locally:

```bash
./scripts/quality_gate.sh
```

### CI Jobs

1. **lint-and-typecheck** - ESLint and TypeScript checks
2. **test** - Vitest unit tests
3. **build** - Production build
4. **e2e** - Playwright end-to-end tests

### Monitoring CI

- Check GitHub Actions tab for status
- Use `gh run watch` to monitor locally
- PR checks must pass before merge

### Troubleshooting CI

- Check workflow logs in GitHub
- Look for specific job failures
- Re-run failed jobs or push fixes
