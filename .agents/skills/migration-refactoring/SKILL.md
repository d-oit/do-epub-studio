---
version: "1.0.0"
name: migration-refactoring
description: >
  Automate complex code migrations and refactorings with safety patterns. Use when
  upgrading dependencies, migrating frameworks, modernizing languages, or performing
  large-scale refactorings.
category: workflow
allowed-tools: Read Write Edit Glob Grep Bash
license: MIT
---

# Migration Refactoring Skill

Automate complex code migrations and refactorings with safety patterns and rollback capabilities.

## When to Use

- Upgrading dependencies (React 18, Node 20, etc.)
- Migrating frameworks (Flask → FastAPI, class → hooks)
- Modernizing languages (Python 2 → 3, JS → TS)
- Large-scale refactoring
- Breaking API changes
- Schema migrations

## Migration Phases

### Phase 1: Analysis

- **Target**: What you're migrating to
- **Scope**: Files/components affected
- **Breaking Changes**: List of breaking changes
- **Risk Level**: Low/Medium/High

### Phase 2: Planning

- **Phase 1**: Update dependencies, add compatibility layers
- **Phase 2**: Core migration changes per file
- **Phase 3**: Run tests, update documentation

### Phase 3: Execution

Commit incremental changes. Create rollback points at each step.

## Breaking Change Analysis

1. **Collect** - Gather all breaking changes from changelogs
2. **Map** - Link changes to affected files
3. **Prioritize** - Order changes by dependency
4. **Automate** - Write scripts for mechanical changes
5. **Manual** - Identify changes requiring human review

### Common Breaking Changes

| Category | Example | Detection |
|----------|---------|-----------|
| API Removed | `oldFunc()` removed | Import errors |
| Signature Changed | `fn(a, b)` → `fn({a, b})` | Test failures |
| Behavior Changed | Returns different type | Type errors |
| Deprecation | Warning on use | Lint warnings |

## Automation Patterns

### Find and Replace

```bash
# Simple replacements
sed -i 's/oldImport/newImport/g' src/**/*.ts

# Regex replacements
find . -name "*.js" -exec sed -i 's/\.bind(this)//g' {} \;
```

### Codemod Scripts

```javascript
// Example codemod
module.exports = function transformer(file, api) {
  const j = api.jscodeshift;
  const root = j(file.source);

  // Find class declarations
  root.find(j.ClassDeclaration)
    .forEach(node => {
      // Transform to functional component
    });

  return root.toSource();
};

// Run with
npx jscodeshift -t transform-class.js src/
```

## Rollback Strategies

### Git-Based Rollback

```bash
# Create migration branch
git checkout -b migration/framework-upgrade

# Commit incremental changes
git add -A
git commit -m "chore: migrate step 1"

# If failure, rollback
git reset --hard HEAD~1
git checkout main

# Or rollback specific files
git checkout HEAD~1 -- src/old-component/
```

### Feature Flags

```javascript
// New implementation behind flag
const useNewAPI = process.env.ENABLE_NEW_API === 'true';

const data = useNewAPI
  ? newAPIFetch()
  : legacyFetch();
```

## Cross-File Dependency Tracking

### Safe Migration Order

1. **Leaf files** (no imports from other files)
2. **Middle files** (some dependencies)
3. **Entry points** (imported by many)
4. **Root files** (main exports)

### Impact Analysis

```markdown
## Impact Analysis

### Direct Dependencies
- file-a.ts imports [target]

### Indirect Dependencies
- file-b.ts imports file-a.ts (imports [target])

### Recommended Order
1. file-b.ts - update first (no dependents)
2. file-a.ts - update second
3. target.ts - update last
```

## Common Migration Patterns

### React Class to Hooks

```javascript
// Before (Class)
class Counter extends React.Component {
  state = { count: 0 };
  render() {
    return <div>{this.state.count}</div>;
  }
}

// After (Hooks)
function Counter() {
  const [count, setCount] = useState(0);
  return <div>{count}</div>;
}
```

### Express to FastAPI

```python
# Before
@app.route('/users', methods=['GET'])
def get_users():
    return jsonify(users)

# After
@app.get('/users')
def get_users():
    return users
```

## Validation

### Pre-Migration Checklist

- [ ] Full test suite passes
- [ ] Current state committed
- [ ] Breaking changes documented
- [ ] Rollback plan tested

### Post-Migration Checklist

- [ ] All tests pass
- [ ] TypeScript types valid
- [ ] Lint passes
- [ ] Build succeeds

### Smoke Tests

```bash
# Quick validation
npm run typecheck
npm run lint
npm test
```

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| Import errors | Broken imports | Update import paths |
| Type errors | API changes | Update types |
| Test failures | Behavior changes | Update tests |

## Integration

- **task-decomposition**: Plan large migrations
- **code-quality**: Ensure code quality after migration
- **testing-strategy**: Validate with tests

## Quality Checklist

- [ ] Breaking changes identified
- [ ] Migration order determined
- [ ] Automated fixes applied
- [ ] Tests pass after migration

## Summary

Safe migrations require analysis and incremental execution.
