# Agent-Browser Patterns & Advanced Usage

## Authentication

### Auth Vault (Recommended)
```bash
# Save credentials once (encrypted with AGENT_BROWSER_ENCRYPTION_KEY)
echo "pass" | agent-browser auth save github --url https://github.com/login --username user --password-stdin

# Login using saved profile (LLM never sees password)
agent-browser auth login github
agent-browser auth list
agent-browser auth delete github
```

### State Persistence
```bash
# Login once and save state
agent-browser batch "open https://app.example.com/login" "snapshot -i"
agent-browser batch "fill @e1 \"$USERNAME\"" "fill @e2 \"$PASSWORD\"" "click @e3" "wait --url **/dashboard" "state save auth.json"

# Reuse in future sessions
agent-browser batch "state load auth.json" "open https://app.example.com/dashboard"
```

## Working with Iframes
Iframe content is automatically inlined in snapshots. Refs inside iframes carry frame context.
```bash
agent-browser batch "open https://example.com/checkout" "snapshot -i"
# @e2 [Iframe] "payment-frame" -> @e3 [input] "Card number"
agent-browser batch "fill @e3 \"4111111111111111\"" "click @e5"
agent-browser frame main          # Return to main frame
```

## iOS Simulator (Mobile Safari)
```bash
agent-browser device list
agent-browser -p ios --device "iPhone 16 Pro" open https://example.com
agent-browser -p ios snapshot -i
agent-browser -p ios tap @e1          # Tap (alias for click)
agent-browser -p ios swipe up         # Mobile gesture
```
Requirements: macOS with Xcode, Appium (`npm install -g appium && appium driver install xcuitest`)

## Security

### Content Boundaries
```bash
export AGENT_BROWSER_CONTENT_BOUNDARIES=1
agent-browser snapshot
# Output wrapped in markers with nonce for LLM trust boundaries
```

### Domain Allowlist
```bash
export AGENT_BROWSER_ALLOWED_DOMAINS="example.com,*.example.com"
agent-browser open https://example.com        # OK
agent-browser open https://malicious.com       # Blocked
```

### Action Policy
```bash
export AGENT_BROWSER_ACTION_POLICY=./policy.json
```
Example `policy.json`: `{ "default": "deny", "allow": ["navigate", "snapshot", "click", "scroll"] }`

### Output Limits
```bash
export AGENT_BROWSER_MAX_OUTPUT=50000
```

## Session Management
```bash
agent-browser --session agent1 open site-a.com
agent-browser --session agent2 open site-b.com
agent-browser session list
agent-browser close --all              # Close all sessions
```

Auto-shutdown daemon after inactivity:
```bash
AGENT_BROWSER_IDLE_TIMEOUT_MS=60000 agent-browser open example.com
```

## Parallel Sessions
```bash
agent-browser --session site1 open https://site-a.com
agent-browser --session site2 open https://site-b.com
agent-browser --session site1 snapshot -i
agent-browser --session site2 snapshot -i
```

## Connect to Existing Chrome
```bash
agent-browser --auto-connect open https://example.com
agent-browser --cdp 9222 snapshot
```

## Color Scheme (Dark Mode)
```bash
agent-browser --color-scheme dark open https://example.com
agent-browser set media dark
```

## Visual Browser (Debugging)
```bash
agent-browser --headed open https://example.com
agent-browser highlight @e1          # Highlight element
agent-browser inspect                # Open Chrome DevTools
agent-browser record start demo.webm # Record session
```

## Local Files
```bash
agent-browser --allow-file-access open file:///path/to/document.pdf
agent-browser --allow-file-access open file:///path/to/page.html
```

## Configuration File
Create `agent-browser.json` in project root:
```json
{ "headed": true, "proxy": "http://localhost:8080", "profile": "./browser-data" }
```
Priority: `~/.agent-browser/config.json` < `./agent-browser.json` < env vars < CLI flags.
