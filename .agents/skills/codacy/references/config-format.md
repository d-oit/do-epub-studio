# Codacy Configuration Format (.codacy.yml)

Codacy can be configured via a `.codacy.yml` or `.codacy.yaml` file in the repository root.

## Engine Name Reference

**CRITICAL:** Engine names in `.codacy.yml` MUST use the current tool
names from Codacy's documentation. Deprecated names are silently ignored,
causing engine-level `exclude_paths` to not apply — files that should be
excluded get analyzed, producing false positives.

Source: https://docs.codacy.com/repositories-configure/codacy-configuration-file/#which-tools-can-be-configured-and-which-name-should-i-use

| Tool | Correct Name | Deprecated Name(s) |
|------|-------------|---------------------|
| ESLint 8 | `eslint-8` | `eslint` |
| ESLint 9 | `eslint-9` | — |
| Pylint | `pylintpython3` | `pylint` |
| PMD | `pmd-7` | — |
| Trivy | `trivy` | `bundleraudit` |
| Stylelint | `stylelint` | `csslint` |
| Opengrep | `opengrep` | — |

## Basic Structure

```yaml
---
version: 1
exclude_paths:
  - "dist/**"
  - "coverage/**"
  - "**/tests/**"
include_paths:
  - "**/tests/integration/**"
languages:
  typescript:
    extensions:
      - ".ts"
      - ".tsx"
  python:
    enabled: false
engines:
  duplication:
    exclude_paths:
      - "apps/web/src/assets/**"
    config:
      languages:
        - "typescript"
        - "javascript"
  metric:
    exclude_paths:
      - "scripts/**"
```

## Key Sections

- **exclude_paths**: Glob patterns for files to ignore globally.
- **include_paths**: Exceptions to `exclude_paths`.
- **languages**: Enable/disable languages or add custom extensions.
- **engines**: Tool-specific configurations (e.g., `duplication`, `metric`, or specific linters).

## Validation

Validate the configuration using the Analysis CLI:
```bash
codacy-analysis-cli validate-configuration --directory `pwd`
```
