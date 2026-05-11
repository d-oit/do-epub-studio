---
version: "1.0.0"
name: cicd-pipeline
description: >
  Design and implement CI/CD pipelines with GitHub Actions, GitLab CI, and Forgejo Actions.
  Use for automated testing, deployment strategies, security scanning, and multi-environment workflows.
category: workflow
allowed-tools: Read Write Edit Glob Grep Bash
license: MIT
---

# CI/CD Pipeline Skill

Design, implement, and maintain CI/CD pipelines for automated testing, deployment, and security scanning.

## When to Use

- Setting up new CI/CD pipelines
- Adding deployment stages
- Configuring security scanning
- Implementing deployment strategies
- Troubleshooting CI/CD failures

## Supported Platforms

| Platform | File | Use Case |
|----------|------|----------|
| GitHub Actions | `.github/workflows/*.yml` | GitHub-hosted repos |
| GitLab CI | `.gitlab-ci.yml` | GitLab-hosted repos |
| Forgejo Actions | `.gitea/workflows/*.yml` | Self-hosted Forgejo |

## Basic CI Pipeline

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Install dependencies
        run: npm ci
      - name: Run tests
        run: npm test
```

## Multi-Environment Deployment

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm test

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm run build

  deploy-staging:
    needs: build
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - run: echo "Deploy to staging"

  deploy-production:
    needs: deploy-staging
    runs-on: ubuntu-latest
    environment: production
    steps:
      - run: echo "Deploy to production"
```

## Deployment Strategies

### Blue-Green Deployment

Deploy to blue (staging), run smoke tests, switch traffic, keep green for rollback.

### Canary Deployment

Deploy to 10% of traffic, monitor metrics, increase if healthy, full rollout or rollback.

### Rolling Deployment

Update one instance at a time, wait for health check, continue until all updated.

## Security Scanning

### Dependency Scanning

```yaml
security-deps:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - name: Audit dependencies
      run: npm audit --audit-level=high
```

### Secret Scanning

```yaml
security-secrets:
  steps:
    - name: Gitleaks
      uses: zricethezav/gitleaks@v9
```

## Testing in CI

### Unit Tests

```yaml
unit-tests:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'
    - run: npm ci
    - run: npm run test:unit
    - name: Upload coverage
      uses: codecov/codecov-action@v4
```

### E2E Tests

```yaml
e2e-tests:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - name: Setup Playwright
      uses: microsoft/playwright@v1
    - run: npm run test:e2e
```

## Caching Strategies

```yaml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '20'
    cache: 'npm'
```

## Quality Gate Workflow

```yaml
name: Quality Gate

on: [pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm run lint

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm run typecheck

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm test

  build:
    needs: [lint, typecheck, test]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm run build
```

## Quality Checklist

- [ ] Pipeline runs on all relevant triggers
- [ ] Quality gates block bad merges
- [ ] Security scans run automatically
- [ ] Deployment is automated

## Summary

CI/CD pipelines automate the path from code to production.
