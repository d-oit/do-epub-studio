# Sub-Agents - Context Control Patterns

> Reference doc - not loaded by default.

Sub-agents are **context firewalls**. The parent agent sees only what it wrote and the
final result - none of the intermediate tool calls, file reads, or searches accumulate
in the parent's context window (context rot).

## When to Use

Good candidates (clear question, many intermediate steps):
- Finding specific implementations in a large codebase
- Tracing data flow across service boundaries
- Codebase pattern analysis
- Web / documentation research
- Security review of completed work

## Sub-Agent System Prompt Rules

Always specify:
1. **Role** - what it does AND does not do
2. **Return format** - condensed answer with `filepath:line` citations
3. **Tool access** - only what is needed for the discrete task

## OpenCode Format (.opencode/agents/<name>.md)

```yaml
---
description: What this agent does.
mode: subagent
tools:
  read: true
  glob: true
  grep: true
---

[Agent system prompt here]
```

## Naming Convention

- Lowercase, hyphens only, max 64 chars
- Examples: `code-reviewer`, `test-runner`, `research-agent`

## Anti-Patterns

- One huge orchestration agent doing everything (fills context fast)
- Sharing context indiscriminately between agents
- Using expensive models for all sub-agents
- Micro-optimizing tool access (tool thrash = worse results)
