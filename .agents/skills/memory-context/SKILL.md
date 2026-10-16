---
version: "1.1.0"
name: memory-context
description: >
  Retrieve past learnings and analysis via csm CLI. Activate at session start
  or when facing a problem that might have been solved before.
category: knowledge-management
compatibility: Requires csm CLI v0.3.2+. Falls back to grep if unavailable.
allowed-tools: Read Grep Glob
license: MIT
---

# Memory Context

Retrieve relevant past learnings, analysis outputs, and project knowledge using the `csm` (Chaotic Semantic Memory) CLI.

> **Note:** csm uses **Hyperdimensional Computing (HDC)** — hash-based token matching, not semantic embeddings. It excels at keyword/lexical search and exact-match recall. For semantic similarity (synonyms, paraphrases), use external embedding models.

## Prerequisites

```bash
# Cargo (recommended)
cargo install chaotic_semantic_memory --version 0.3.2 --bin csm

# npm alternative
npm install -g @d-o-hub/csm
```

### Health Check

Run `scripts/check_csm.sh` to verify csm is installed and the memory index is accessible. Falls back to `grep` if unavailable.

## When to Use

- At session start to recall previous work
- When facing a problem that might have been solved before
- To retrieve specific findings from `analysis/` or `plans/`

## Indexing (Run Once)

```bash
# Index plans and analysis (keyword-level matching)
csm index-dir --glob "plans/**/*.md" --glob "analysis/**/*.md" --heading-level 2

# Index codebase knowledge
csm index-dir --glob "**/*.md" --heading-level 2

# Specify database location
csm init --database .git/memory-index/csm.db
```

Index stored in `.git/memory-index/csm.db` (per-clone, never committed). Tables use `csm_` prefix (`csm_concepts`, `csm_associations`) for namespace isolation.

## Querying

```bash
# Keyword/lexical query (HDC matching)
csm query "offline sync architecture" -k 5 --database .git/memory-index/csm.db

# JSON output for structured parsing
csm query "TRIZ contradiction offline availability" -k 3 --output json

# BM25+HDC hybrid search (v0.3.0+)
csm search "Turso sync" --hybrid -k 5

# With abstain threshold (v0.3.2+)
csm query "auth flow" -k 5 --abstain-threshold 0.3
```

## CLI Commands (v0.3.2)

| Command | Description |
|---------|-------------|
| `csm init --database <path>` | Initialize memory database |
| `csm inject <concept>` | Add concept to memory |
| `csm probe <concept> -k <n>` | Find similar concepts |
| `csm query <text> -k <n>` | Natural language query |
| `csm search <text> --hybrid` | BM25+HDC hybrid retrieval |
| `csm index-dir --glob <pattern>` | Batch index directory |
| `csm export --output <file>` | Export memory snapshot |
| `csm import --input <file>` | Import memory snapshot |

## Token Budget

Use `-k` (top-k) to control output size. Default is 5 results.

## Alternative Without csm CLI

If csm is not installed, use grep/find to search:

```bash
grep -r "offline sync" plans/ analysis/
```

## Reference

- GitHub: [d-o-hub/chaotic_semantic_memory](https://github.com/d-o-hub/chaotic_semantic_memory)
- Docs: [docs.rs/chaotic_semantic_memory](https://docs.rs/chaotic_semantic_memory)
- NPM: [@d-o-hub/csm](https://www.npmjs.com/package/@d-o-hub/csm)

## Rationalizations

| Rationalization | Reality |
|-----------------|---------|
| "csm will understand my paraphrased question." | csm is Hyperdimensional Computing — hash-based token matching, not embeddings. It misses synonyms; query with literal domain terms or use an external embedding model. |
| "I'll commit `.git/memory-index/csm.db` so the team shares the index." | The index is per-clone and never committed; each clone runs `csm init` + `csm index-dir`. |
| "No hits — I'll just raise `-k`." | v0.3.2 has `--abstain-threshold` for exactly this; a larger `-k` only returns weaker matches. |
| "csm isn't installed, so past learnings are unreachable." | `scripts/check_csm.sh` health-checks it, and the documented fallback is `grep -r "<terms>" plans/ analysis/`. |

## Red Flags

- [ ] Empty/low-signal results from a synonym query treated as "nothing was ever recorded".
- [ ] `csm_concepts`, `csm_associations`, or the `.db` file showing up in `git status`.
- [ ] Index built without `--heading-level 2`, so `##` sections under `plans/` and `analysis/` are not retrievable.
- [ ] `-k` left large (blowing the token budget) instead of the default 5.
- [ ] csm availability asserted without running `scripts/check_csm.sh`.
