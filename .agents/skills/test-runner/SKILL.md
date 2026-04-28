---
version: "1.0.0"
name: test-runner
description: >
  Execute tests, analyze results, and diagnose failures across any testing framework.
  Use when running test suites, debugging failing tests, or configuring CI/CD testing pipelines.
category: testing
allowed-tools: Read Write Edit Glob Grep Bash
license: MIT
---

# Test Runner Skill

Execute tests, analyze results, and diagnose failures across any testing framework.

## When to Use

- Running test suites (unit, integration, E2E)
- Debugging failing tests
- Configuring CI/CD testing pipelines
- Adding new test coverage
- Performance testing

## Supported Frameworks

| Language | Frameworks |
|----------|------------|
| JavaScript/TypeScript | Vitest, Jest, Playwright, Mocha |
| Python | pytest, unittest |
| Rust | cargo test |
| Go | go test |

## Test Execution Patterns

### Quick Test Run

```bash
# Run all tests
npm test

# Run specific test file
npm test -- src/api/auth.test.ts

# Run tests matching pattern
npm test -- --grep "auth"

# Watch mode
npm test -- --watch
```

### CI/CD Test Run

```bash
# Run with coverage
npm test -- --coverage

# Run with JSON output for CI
npm test -- --json > test-results.json

# Run specific suites
npm run test:unit
npm run test:integration
npm run test:e2e
```

### Debugging Failing Tests

```bash
# Run with verbose output
npm test -- --verbose

# Run single test
npm test -- --testNamePattern="exact test name"

# Show local variables on failure
npm test -- --expand

# Debug with Node inspector
node --inspect-brk node_modules/.bin/vitest run
```

## Result Analysis

### Interpreting Test Output

```
PASS  src/api/auth.test.ts (5.2 s)
  ✓ should authenticate valid user (3 ms)
  ✓ should reject invalid credentials (2 ms)
  ✕ should handle rate limiting (10 ms)

FAIL src/api/payment.test.ts (3.1 s)
  ✕ should process payment (20 ms)
    expect(received).toBe(expected)
    
    Expected: "completed"
    Received: "pending"
```

### Common Failure Patterns

| Pattern | Likely Cause | Solution |
|---------|--------------|----------|
| Timeout | Async not awaited | Add `await` or increase timeout |
| Null reference | Mock not provided | Add mock to test setup |
| Snapshot mismatch | UI changed | Update snapshot or fix implementation |
| Flaky test | Race condition | Add wait or fix timing issue |
| Permission denied | Missing env vars | Add test env configuration |

## Test Organization

### By Scope

```
tests/
├── unit/           # Fast, isolated tests
├── integration/    # Test component interactions
├── e2e/           # Full user flows
└── performance/   # Load and stress tests
```

### Test Naming

```
# Good
should_return_401_for_unauthenticated_request
when_user_is_admin_can_delete_other_users

# Bad
test1
test_auth
```

### AAA Pattern

```typescript
describe('Authentication', () => {
  it('should authenticate valid user', () => {
    // Arrange
    const credentials = { email: 'test@example.com', password: 'password123' };
    
    // Act
    const result = authService.login(credentials);
    
    // Assert
    expect(result).toBeTruthy();
    expect(result.token).toBeDefined();
  });
});
```

## Mock Strategies

### Common Mocks

```typescript
// Mock external service
jest.mock('../services/external-api');

// Mock environment
process.env.NODE_ENV = 'test';

// Mock file system
jest.mock('fs', () => ({
  readFileSync: jest.fn(),
}));

// Mock date
jest.useFakeTimers();
```

### Mocking Database

```typescript
// Use test database
const testDb = createTestDatabase();

// Clean state between tests
beforeEach(async () => {
  await testDb.clear();
});
```

## Coverage Analysis

### Interpreting Coverage Reports

| Metric | Target | Meaning |
|--------|--------|---------|
| Line | 80%+ | Code lines executed |
| Branch | 75%+ | Conditional paths taken |
| Function | 80%+ | Functions called |
| Statement | 80%+ | Statements executed |

### Improving Coverage

1. **Identify gaps** - Review uncovered lines
2. **Add edge cases** - Test error paths
3. **Mock wisely** - Don't over-mock real logic
4. **Integration tests** - Cover component interaction

## CI/CD Integration

### GitHub Actions

```yaml
test:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - name: Run tests
      run: npm test -- --coverage
    - name: Upload coverage
      uses: codecov/codecov-action@v4
```

### Quality Gates

```bash
# Fail if coverage below threshold
npm test -- --coverage --coverageThreshold='{"global":{"branches":80}}'

# Fail on first error
npm test -- --bail

# Run typecheck first
npm run typecheck && npm test
```

## EPUB Studio Specific

### Test Suites

| Suite | Command | Purpose |
|-------|---------|---------|
| Unit | `npm run test:unit` | Component logic |
| Integration | `npm run test:integration` | API/DB integration |
| E2E | `npm run test:e2e` | Full user flows |
| Performance | `npm run test:perf` | Load testing |

### Required Test Coverage

- [ ] Authentication flow
- [ ] Permission checks
- [ ] EPUB parsing
- [ ] CFI navigation
- [ ] Offline sync
- [ ] API endpoints
- [ ] Error handling

### Running Specific Test Categories

```bash
# Test auth only
npm test -- --grep "auth"

# Test EPUB parsing only
npm test -- --grep "epub"

# Test sync only
npm test -- --grep "sync"
```

## Debugging Tips

### When Tests Fail

1. **Read the error** - Don't scan, read fully
2. **Check the stack trace** - Find your code
3. **Reproduce locally** - Run single test
4. **Check test isolation** - Are tests independent?
5. **Verify mocks** - Are mocks accurate?

### Common Issues

| Issue | Fix |
|-------|-----|
| "Cannot find module" | Check path, install dependencies |
| "Async callback not called" | Add done() or return promise |
| "Expected X, got Y" | Check mock implementation |
| "act() timeout" | Fix async timing issues |

## Integration

- **testing-strategy**: Design test approach
- **testdata-builders**: Create test fixtures
- **dogfood**: Exploratory testing
- **cicd-pipeline**: CI/CD test configuration

## Quality Checklist

- [ ] Tests are deterministic (no flakiness)
- [ ] Tests run fast (< 100ms each)
- [ ] Clear test names describe behavior
- [ ] Proper AAA structure
- [ ] Good coverage of edge cases
- [ ] Mocks are accurate
- [ ] No test interdependence

## Summary

Effective test execution requires understanding frameworks, analyzing failures, and integrating with CI/CD. Always run full suite before merge and investigate flakiness immediately.