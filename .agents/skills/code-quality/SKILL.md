---
version: "1.0.0"
name: code-quality
description: Review and improve code quality across any programming language. Use when conducting code reviews, refactoring for best practices, identifying code smells, or improving maintainability.
version: "1.0"
---

# Code Quality Reviewer

Expert skill for code quality assessment and improvement.

## Quick Check

- [ ] No magic numbers (use named constants)
- [ ] Functions under 50 lines
- [ ] DRY principle followed
- [ ] Error handling implemented
- [ ] Tests cover edge cases
- [ ] No code smells

## When to Use

- Code reviews
- Refactoring
- Identifying code smells
- Pre-commit quality checks
- Legacy modernization

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

### DO:
- Use named constants
- Write small functions
- Handle errors explicitly
- Write edge case tests
- Follow language idioms

### DON'T:
- Copy-paste code
- Ignore compiler warnings
- Skip error handling
- Mix abstraction levels
