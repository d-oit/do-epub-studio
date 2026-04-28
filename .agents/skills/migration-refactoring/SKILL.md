do-epub-studio/.agents/skills/migration-refactoring/SKILL.md
```

---

```markdown
---
version: "1.0.0"
name: migration-refactoring
description: >
  Automate complex code migrations and refactorings with safety patterns. Use when
  upgrading dependencies, migrating frameworks, modernizing languages, or performing
  large-scale refactorings. Includes breaking change analysis, automated fix application,
  rollback strategies, and cross-file dependency tracking.
category: refactoring
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

```markdown
## Migration Analysis

**Target**: [What you're migrating to]
**Scope**: [Files/components affected]
**Breaking Changes**: [List of breaking changes]
**Risk Level**: Low/Medium/High

### Dependencies
- [Dependency 1]: current → target
- [Dependency 2]: current → target
```

### Phase 2: Planning

```markdown
## Migration Plan

### Phase 1: Preparation
- Update dependencies
- Add compatibility layers

### Phase 2: Core Migration
- [File 1]: Changes needed
- [File 2]: Changes needed

### Phase 3: Verification
- Run tests
- Update documentation
```

### Phase 3: Execution

```markdown
## Execution Log

- [x] Step 1: Update package.json
- [ ] Step 2: Run migration script
- [ ] Step 3: Fix lint errors
- [ ] Step 4: Run tests
```

## Breaking Change Analysis

### Steps

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
// transform-class.js - Example codemod
module.exports = function transformer(file, api) {
  const j = api.jscodeshift;
  const root = j(file.source);

  // Find class declarations
  root.find(j.ClassDeclaration)
    .forEach(node => {
      // Transform to functional component
      // ...
    });

  return root.toSource();
};

// Run with
npx jscodeshift -t transform-class.js src/
```

### Migration Scripts

```python
#!/usr/bin/env python3
"""
Migrate old API to new API.
"""

import subprocess
import sys
from pathlib import Path

def migrate_file(filepath: Path):
    """Apply migrations to a single file."""
    content = filepath.read_text()
    
    # Apply replacements
    content = content.replace('oldFunc()', 'newFunc()')
    content = content.replace('legacyOption', 'newOption')
    
    filepath.write_text(content)

def main():
    files = list(Path('src').rglob('*.py'))
    for f in files:
        migrate_file(f)
    print(f"Migrated {len(files)} files")

if __name__ == '__main__':
    main()
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

### Branch per Migration

```bash
# Create feature branch for migration
git checkout -b refactor/migrate-to-react-18

# Work incrementally
git add -A && git commit -m "chore: update peer dependencies"

# Test in isolation
npm run test:integration

# Merge when ready
git checkout main
git merge refactor/migrate-to-react-18
```

## Cross-File Dependency Tracking

### Dependency Graph

```bash
# Generate import graph
npx depcruise src/ --output-type dot | dot -Tpng deps.png

# Find affected files
npx depcruise src/ --include 'src/affected.ts'
```

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

### Safe Migration Order

1. **Leaf files** (no imports from other files)
2. **Middle files** (some dependencies)
3. **Entry points** (imported by many)
4. **Root files** (main exports)

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

### CommonJS to ESM

```javascript
// Before
const fs = require('fs');
module.exports = { fn };

// After
import fs from 'fs';
export const fn = {};
```

## Validation

### Pre-Migration Checklist

- [ ] Full test suite passes
- [ ] Current state committed
- [ ] Breaking changes documented
- [ ] Rollback plan tested
- [ ] Backup created

### Post-Migration Checklist

- [ ] All tests pass
- [ ] TypeScript types valid
- [ ] Lint passes
- [ ] Build succeeds
- [ ] E2E tests pass
- [ ] Documentation updated

### Smoke Tests

```bash
# Quick validation
npm run typecheck
npm run lint
npm test

# Manual smoke test
# - App loads
# - Login works
# - Core feature works
```

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| Import errors | Broken imports | Update import paths |
| Type errors | API changes | Update types |
| Test failures | Behavior changes | Update tests |
| Runtime errors | Missing deps | Install dependencies |

## EPUB Studio Specific

### Common Migrations

| Migration | Risk | Effort |
|-----------|------|--------|
| React version upgrade | Medium | High |
| Node version upgrade | Low | Medium |
| Package updates | Low | Low |
| API restructuring | High | High |

### Before Migration

1. Check test coverage
2. Create migration branch
3. Document all custom implementations
4. Review breaking changes

### After Migration

1. Run full test suite
2. Test EPUB rendering
3. Verify CFI navigation
4. Check offline sync

## Integration

- **triz-solver**: Use when migration has trade-offs
- **task-decomposition**: Plan large migrations
- **code-quality**: Ensure code quality after migration
- **testing-strategy**: Validate with tests

## Quality Checklist

- [ ] Breaking changes identified
- [ ] Migration order determined
- [ ] Automated fixes applied
- [ ] Manual changes tracked
- [ ] Tests pass after migration
- [ ] Documentation updated
- [ ] Rollback tested

## Summary

Safe migrations require thorough analysis, incremental execution, and robust rollback plans. Always test in isolation before merging and maintain backward compatibility where possible.