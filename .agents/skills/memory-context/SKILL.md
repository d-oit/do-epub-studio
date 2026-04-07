---
name: memory-context
description: Retrieve semantically relevant past learnings and analysis outputs. Use when you need to recall previous work, face a problem that might have been solved before, or retrieve specific findings from analysis/ or plans/.
license: MIT
compatibility: Requires csm CLI (cargo install chaotic_semantic_memory --features cli)
---

# Memory Context

Retrieve semantically relevant past learnings, analysis outputs, and project knowledge using the `csm` (Chaotic Semantic Memory) CLI.

## Prerequisites

```bash
cargo install chaotic_semantic_memory --features cli
```

## When to Use

- At session start to recall previous work
- When facing a problem that might have been solved before
- To retrieve specific findings from `analysis/` or `plans/`

## Indexing (Run Once)

```bash
# Index plans and analysis
csm index-dir --glob "plans/**/*.md" --glob "analysis/**/*.md" --heading-level 2

# Index codebase knowledge
csm index-dir --glob "**/*.md" --heading-level 2
```

Index stored in `.git/memory-index/csm.db` (per-clone, never committed).

## Querying

```bash
# Natural language query
csm query "offline sync architecture" --top-k 5

# Find specific contradiction analysis
csm query "TRIZ contradiction offline availability" --top-k 3 --output-format json

# Code-aware query
csm query "Turso sync lock mode" --code-aware --top-k 5
```

## Token Budget

Use `--top-k` to control output size. Default MAX_CONTEXT_TOKENS is 4000.

## Alternative Without csm CLI

If csm is not installed, use grep/find to search:
```bash
grep -r "offline sync" plans/ analysis/
```
