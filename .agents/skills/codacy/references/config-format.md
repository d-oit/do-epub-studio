# Codacy Configuration Format (.codacy.yml)

Codacy can be configured via a `.codacy.yml` or `.codacy.yaml` file in the repository root.

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
