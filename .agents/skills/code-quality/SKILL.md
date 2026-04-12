---
version: "1.0.0"
name: code-quality
description: >
  Review and improve inline code quality. Activate for code smells,
  refactoring, DRY violations, and best-practice fixes in active files.
category: quality
allowed-tools: Read Grep Glob
license: MIT
---

# Code Quality Reviewer

Review and improve inline code patterns. Operates at the file/function level
—not at the PR or diff level (use `code-review-assistant` for that).

## Quick Check

- [ ] No magic numbers (use named constants)
- [ ] Functions under 50 lines
- [ ] DRY principle followed
- [ ] Error handling implemented
- [ ] Tests cover edge cases
- [ ] No code smells

## When to Use

- Refactoring a function you're actively editing
- Fixing code smells in the current file
- Identifying DRY violations in new code
- Pre-write quality check before committing a file
- Legacy code modernization at the function level

## Core Principles

### DRY

Extract duplicated logic into shared functions or constants.

### Single Responsibility

Each function should do one thing well. Split functions that validate, save, and notify.

### No Magic Numbers

Use named constants instead of bare numbers like `30000`.

## Code Smells

### Bloaters

- Long Method (>50 lines)
- Large Class (>300 lines)
- Long Parameter List (>4 params)

### Dispensables

- Duplicate Code
- Dead Code
- Speculative Generality

### Couplers

- Feature Envy
- Message Chains (obj.getX().getY())

## Quality Criteria

- [ ] No magic numbers
- [ ] Functions under 50 lines
- [ ] DRY followed
- [ ] Error handling complete
- [ ] Tests cover edge cases
- [ ] No code smells

## Best Practices

### DO

- Use named constants
- Write small functions
- Handle errors explicitly
- Write edge case tests
- Follow language idioms

### DON'T

- Copy-paste code
- Ignore compiler warnings
- Skip error handling
- Mix abstraction levels
