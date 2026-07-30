# Snapshot and Refs

Compact element references that reduce context usage dramatically for AI agents.

**Related**: [commands.md](commands.md) for full command reference, [SKILL.md](../SKILL.md) for quick start.

## How Refs Work

Traditional approach:

```
Full DOM/HTML → AI parses → CSS selector → Action (~3000-5000 tokens)
```

agent-browser approach:

```
Compact snapshot → @refs assigned → Direct interaction (~200-400 tokens)
```

## The Snapshot Command

```bash
# Basic snapshot (shows page structure)
agent-browser snapshot

# Interactive snapshot (-i flag) - RECOMMENDED
agent-browser snapshot -i
```

### Snapshot Output Format

```
Page: Example Site - Home
URL: https://example.com

@e1 [header]
  @e2 [nav]
    @e3 [a] "Home"
    @e4 [a] "Products"
  @e5 [button] "Sign In"

@e6 [main]
  @e7 [form]
    @e8 [input type="email"] placeholder="Email"
    @e9 [input type="password"] placeholder="Password"
    @e10 [button type="submit"] "Log In"
```

## Using Refs

Once you have refs, interact directly:

```bash
agent-browser click @e5          # Click "Sign In"
agent-browser fill @e8 "user@example.com"
agent-browser fill @e9 "password123"
agent-browser click @e10         # Submit the form
```

## Ref Lifecycle

**IMPORTANT**: Refs are invalidated when the page changes!

```bash
agent-browser snapshot -i
# @e1 [button] "Next"

agent-browser click @e1   # triggers page change

# MUST re-snapshot to get new refs!
agent-browser snapshot -i
# @e1 [h1] "Page 2"  ← Different element now!
```

## Best Practices

### 1. Always Snapshot Before Interacting

```bash
# CORRECT
agent-browser open https://example.com
agent-browser snapshot -i          # Get refs first
agent-browser click @e1            # Use ref

# WRONG
agent-browser open https://example.com
agent-browser click @e1            # Ref doesn't exist yet!
```

### 2. Re-Snapshot After Navigation or Dynamic Changes

```bash
agent-browser click @e5            # Navigates to new page
agent-browser snapshot -i          # Get new refs

agent-browser click @e1            # Opens dropdown
agent-browser snapshot -i          # See dropdown items
agent-browser click @e7            # Select item
```

### 3. Snapshot Specific Regions

For complex pages, scope the snapshot to a container:

```bash
agent-browser snapshot @e9
```

## Iframes

Snapshots automatically detect and inline iframe content. Refs assigned to elements inside iframes carry frame context, so `click`, `fill`, and `type` work without manually switching frames.

```bash
agent-browser snapshot -i
# @e1 [heading] "Checkout"
# @e2 [Iframe] "payment-frame"
#   @e3 [input] "Card number"
#   @e4 [input] "Expiry"
#   @e5 [button] "Pay"

agent-browser fill @e3 "4111111111111111"
agent-browser fill @e4 "12/28"
agent-browser click @e5
```

**Key details:**

- Only one level of iframe nesting is expanded
- Cross-origin iframes that block accessibility tree access are silently skipped
- To scope a snapshot to a single iframe, use `frame @ref` then `snapshot -i`

## Troubleshooting

### "Ref not found" Error

```bash
# Ref may have changed — re-snapshot
agent-browser snapshot -i
```

### Element Not Visible in Snapshot

```bash
# Scroll down to reveal element
agent-browser scroll down 1000
agent-browser snapshot -i

# Or wait for dynamic content
agent-browser wait 1000
agent-browser snapshot -i
```

### Too Many Elements

```bash
# Snapshot specific container
agent-browser snapshot @e5

# Or use get text for content-only extraction
agent-browser get text @e5
```
