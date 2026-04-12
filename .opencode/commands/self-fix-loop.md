---
description: Self-fix loop for fixing errors
subtask: false
---

# Self-fix loop

Handle self-fix loops when encountering errors.

## Error Handling Pattern

When an error occurs:

1. **Analyze** - Understand the error message
2. **Research** - Look for similar issues in codebase
3. **Fix** - Apply the fix
4. **Verify** - Run quality gate
5. **Repeat** if needed

## Common Error Patterns

### Type Errors

- Check TypeScript strict mode
- Run `pnpm typecheck`

### Lint Errors

- Run `pnpm lint`
- Check eslint configuration

### Test Failures

- Run tests with verbose output
- Check test assertions

### Build Errors

- Check for type errors
- Verify dependencies

## Best Practices

- Don't ignore errors
- Fix root cause, not symptoms
- Run quality gate after each fix
- Ask for help after 3 failed attempts
