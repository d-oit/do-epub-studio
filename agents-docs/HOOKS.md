# Hooks - Verification and Automation

> Reference doc - not loaded by default.

Hooks are agent lifecycle commands that enforce deterministic control flow.
Supported by: Claude Code, OpenCode.

## Golden Rules

- **Enforcement hooks: success is silent** (exit 0; no unnecessary output).
- **Failure is explicit** (use the event's documented exit behavior; surface actionable errors).
- **Context-injection hooks are an intentional exception**: `SessionStart` may inject bounded
  context (the repository's documentation index and changelog) into the session. It is not
  enforcement, so it prints its context on success.
- **Context-efficient** - swallow passing output; stream only failures

## Common Use Cases

| Hook type      | Purpose                                                       |
| -------------- | ------------------------------------------------------------- |
| Stop hook      | Typecheck + lint + format after every agent action            |
| Pre-tool hook  | Approve/deny specific tool calls (e.g. block destructive ops) |
| Post-tool hook | Send notification, create PR, set up preview env              |

## Stop Hook Template

```bash
#!/bin/bash
cd "$CLAUDE_PROJECT_DIR"

OUTPUT=$(your-lint-cmd && your-typecheck-cmd 2>&1)

if [ $? -ne 0 ]; then
  echo "$OUTPUT" >&2
  exit 2
fi
# success: exit 0 silently
```

## Validate Skills Hook

Add to your stop hook to always verify symlinks are intact:

```bash
./scripts/validate-skills.sh || exit 2
```

## Back-Pressure Priority (implement top-down)

1. Typechecks / build - fast, deterministic
2. Unit tests - validates logic
3. Integration tests - validates system behavior
4. Lint / format - enforces style
5. Coverage reporting - surface drops via hook

See `agents-docs/CONTEXT.md` for full back-pressure patterns.
