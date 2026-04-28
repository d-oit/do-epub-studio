do-epub-studio/.agents/skills/cicd-pipeline/SKILL.md
```

---
version: "1.0.0"
name: cicd-pipeline
description: >
  Design and implement CI/CD pipelines with GitHub Actions, GitLab CI, and Forgejo Actions.
  Use for automated testing, deployment strategies, security scanning, and multi-environment workflows.
category: devops
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

## Pipeline Structure

### Basic CI Pipeline

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
      - name: Lint
        run: npm run lint
```

### Multi-Environment Deployment

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
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - run: echo "Deploy to staging"

  deploy-production:
    needs: deploy-staging
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest
    environment: production
    steps:
      - run: echo "Deploy to production"
```

## Deployment Strategies

### 1. Blue-Green Deployment

```yaml
blue-green:
  steps:
    - Deploy to blue (staging)
    - Run smoke tests
    - Switch traffic to blue
    - Keep green for rollback
    - After confirm: decommission green
```

### 2. Canary Deployment

```yaml
canary:
  steps:
    - Deploy to 10% of traffic
    - Monitor metrics
    - Increase traffic if healthy
    - Full rollout or rollback
```

### 3. Rolling Deployment

```yaml
rolling:
  steps:
    - Update one instance at a time
    - Wait for health check
    - Continue until all updated
```

## Security Scanning

### Dependency Scanning

```yaml
security-deps:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - name: Audit dependencies
      run: npm audit --audit-level=high
    - name: Check for vulnerabilities
      uses: snyk/actions/node@master
      env:
        SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
```

### Secret Scanning

```yaml
security-secrets:
  steps:
    - name: Gitleaks
      uses: zricethezav/gitleaks@v9
      with:
        config-path: .gitleaks.toml
```

### Code Quality Scanning

```yaml
security-code:
  steps:
    - name: CodeQL
      uses: github/codeql-action/analyze@v3
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
    - uses: actions/upload-artifact@v4
      if: failure()
      with:
        name: playwright-report
        path: playwright-report/
```

### Performance Tests

```yaml
perf-tests:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - name: Run Lighthouse CI
      uses: treosh/lighthouse-ci-action@v11
      with:
        urls: https://your-app.com
        uploadArtifacts: true
```

## Caching Strategies

### npm Cache

```yaml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '20'
    cache: 'npm'
```

### Docker Layer Caching

```yaml
- name: Build Docker image
  uses: docker/build-push-action@v6
  with:
    context: .
    push: false
    tags: user/app:latest
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

## Workflow Patterns

### Quality Gate Workflow

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

### Parallel Job Execution

```yaml
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - run: npm run lint

  test-unit:
    runs-on: ubuntu-latest
    steps:
      - run: npm run test:unit

  test-e2e:
    runs-on: ubuntu-latest
    steps:
      - run: npm run test:e2e

  # All run in parallel
  build:
    needs: [lint, test-unit, test-e2e]
    runs-on: ubuntu-latest
    steps:
      - run: npm run build
```

## Environment Variables

### Repository Secrets

| Secret | Description |
|--------|-------------|
| `DEPLOY_TOKEN` | Token for deployment |
| `NPM_TOKEN` | npm publish token |
| `CODECOV_TOKEN` | Codecov upload token |
| `SNYK_TOKEN` | Snyk vulnerability scanning |

### Environment-Specific Variables

```yaml
env:
  staging:
    API_URL: https://staging-api.example.com
  production:
    API_URL: https://api.example.com
```

## EPUB Studio Specific

### Required Pipeline Checks

- [ ] Node.js build succeeds
- [ ] TypeScript types valid
- [ ] ESLint passes no warnings
- [ ] Unit tests pass
- [ ] E2E tests pass
- [ ] Build produces valid output

### Deployment Targets

| Environment | Trigger | Approval Required |
|-------------|---------|-------------------|
| Staging | Push to `main` | No |
| Production | Release tag | Yes |

### Workers Deployment

```yaml
deploy-workers:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - name: Deploy to Cloudflare
      uses: cloudflare/wrangler-action@v3
      with:
        apiToken: ${{ secrets.CF_API_TOKEN }}
        accountId: ${{ secrets.CF_ACCOUNT_ID }}
        command: deploy
```

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Tests timing out | Increase timeout or optimize tests |
| Cache miss | Verify cache key is stable |
| Flaky tests | Use retry logic, fix root cause |
| Secret not found | Check repository secrets configuration |
| Permission denied | Check token scopes |

### Debug Tips

```yaml
- name: Debug
  run: |
    echo "GitHub ref: ${{ github.ref }}"
    echo "Event: ${{ github.event_name }}"
    env | grep -E '^(INPUT_|GITHUB_)'
```

## Integration

- **github-workflow**: For PR and merge automation
- **security-code-auditor**: For security scanning
- **testing-strategy**: For test configuration
- **code-quality**: For lint configuration

## Quality Checklist

- [ ] Pipeline runs on all relevant triggers
- [ ] Quality gates block bad merges
- [ ] Caching reduces build time
- [ ] Security scans run automatically
- [ ] Deployment is automated
- [ ] Rollback procedure documented
- [ ] Environment variables secured
- [ ] Logs are informative

## Reference Files

- `.github/workflows/` - Workflow definitions
- `agents-docs/CI-CD.md` - Detailed deployment docs
- `.gitleaks.toml` - Secret scanning config

## Summary

CI/CD pipelines automate the path from code to production. Design for reliability, security, and speed. Always include quality gates and monitoring.