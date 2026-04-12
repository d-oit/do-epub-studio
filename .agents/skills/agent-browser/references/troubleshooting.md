# Agent-Browser Troubleshooting

## Timeouts and Slow Pages

Default timeout is 25 seconds. Override with `AGENT_BROWSER_DEFAULT_TIMEOUT` (milliseconds).

**Important:** `open` already waits for the page `load` event. No additional wait needed in most cases. Only add explicit wait when content loads asynchronously.

```bash
# Wait for specific element (preferred for dynamic content)
agent-browser wait "#content"

# Wait fixed duration (good for slow SPAs)
agent-browser wait 2000

# Wait for URL pattern (useful after redirects)
agent-browser wait --url "**/dashboard"

# Wait for text to appear
agent-browser wait --text "Results loaded"

# Wait for JavaScript condition
agent-browser wait --fn "document.querySelectorAll('.item').length > 0"
```

**AVOID `wait --load networkidle`** on sites with:

- Ad networks
- Analytics/tracking
- Websockets
- Server-sent events

These cause `networkidle` to hang indefinitely. Use `wait 2000` or `wait <selector>` instead.

## JavaScript Dialogs (alert / confirm / prompt)

Dialogs block all browser commands until dismissed. If commands timeout unexpectedly:

```bash
agent-browser dialog status     # Check if dialog is blocking
agent-browser dialog accept     # Accept (click OK)
agent-browser dialog dismiss    # Dismiss (click Cancel)
```

When a dialog is pending, all command responses include a `warning` field.

## Ref Lifecycle

**Refs (`@e1`, `@e2`, etc.) are invalidated when the page changes.** Always re-snapshot after:

- Clicking links or buttons that navigate
- Form submissions
- Dynamic content loading (dropdowns, modals)

```bash
agent-browser click @e5              # Navigates to new page
agent-browser snapshot -i            # MUST re-snapshot
agent-browser click @e1              # Use new refs
```

## Annotated Screenshots

Use `--annotate` for screenshots with numbered labels mapped to refs:

```bash
agent-browser screenshot --annotate
# [1] @e1 button "Submit"
# [2] @e2 link "Home"
agent-browser click @e2              # Use ref from annotated screenshot
```

Use when:

- Page has unlabeled icon buttons
- Need visual layout verification
- Canvas or chart elements (invisible to text snapshots)
- Spatial reasoning about element positions

## Semantic Locators (Fallback)

When refs are unavailable or unreliable:

```bash
agent-browser find text "Sign In" click
agent-browser find label "Email" fill "user@test.com"
agent-browser find role button click --name "Submit"
```

## JavaScript Eval Quoting

**Shell quoting can corrupt complex expressions.** Rules:

- Simple expressions: `eval 'document.title'` (single quotes)
- Nested quotes/arrows/templates: `eval --stdin <<'EVALEOF' ... EVALEOF`
- Programmatic scripts: `eval -b "$(echo -n '...' | base64)"`

Problematic characters in shell: `"`, `!`, backticks, `$()`

## Session Cleanup

Always close sessions to prevent leaked processes:

```bash
agent-browser close                    # Close default session
agent-browser --session my-session close   # Close specific session
agent-browser close --all              # Nuclear option
```

If daemon is stuck: `agent-browser close --all`
