# Agent-Browser Command Reference

## Navigation
```bash
agent-browser open <url>              # Navigate (aliases: goto, navigate)
agent-browser close                   # Close browser
agent-browser close --all             # Close all active sessions
```

## Snapshot
```bash
agent-browser snapshot -i             # Interactive elements with refs (recommended)
agent-browser snapshot -i --urls      # Include href URLs for links
agent-browser snapshot -s "#selector" # Scope to CSS selector
```

## Interaction
```bash
agent-browser click @e1               # Click element
agent-browser fill @e2 "text"         # Clear and type text
agent-browser type @e2 "text"         # Type without clearing
agent-browser select @e1 "option"     # Select dropdown option
agent-browser check @e1               # Check checkbox
agent-browser press Enter             # Press key
agent-browser scroll down 500         # Scroll page
```

## Wait
```bash
agent-browser wait @e1                # Wait for element
agent-browser wait 2000               # Wait milliseconds
agent-browser wait --url "**/page"    # Wait for URL pattern
agent-browser wait --text "Welcome"   # Wait for text (substring match)
agent-browser wait --fn "!document.body.innerText.includes('Loading...')"
agent-browser wait "#spinner" --state hidden  # Wait for element to disappear
```

## Tab Management
```bash
agent-browser tab list                # List all open tabs
agent-browser tab new                 # Open blank new tab
agent-browser tab new <url>           # Open URL in new tab
agent-browser tab 2                   # Switch to tab by index (0-based)
agent-browser tab close               # Close current tab
agent-browser tab close 2             # Close tab by index
```

## Network
```bash
agent-browser network requests                 # Inspect tracked requests
agent-browser network requests --type xhr,fetch  # Filter by resource type
agent-browser network request <requestId>      # View full request/response
agent-browser network route "**/api/*" --abort  # Block matching requests
agent-browser network har start                # Start HAR recording
agent-browser network har stop ./capture.har   # Stop and save HAR
```

## Viewport & Device
```bash
agent-browser set viewport 1920 1080          # Set viewport size
agent-browser set viewport 1920 1080 2        # 2x retina
agent-browser set device "iPhone 14"          # Emulate device
```

## Capture
```bash
agent-browser screenshot              # Screenshot to temp dir
agent-browser screenshot --full       # Full page screenshot
agent-browser screenshot --annotate   # Annotated with numbered labels
agent-browser pdf output.pdf          # Save as PDF
```

## Dialogs
```bash
agent-browser dialog accept              # Accept dialog
agent-browser dialog accept "my input"   # Accept prompt with text
agent-browser dialog dismiss             # Dismiss/cancel dialog
agent-browser dialog status              # Check pending dialog
```

## Diff (Compare Pages)
```bash
agent-browser diff snapshot                          # Current vs last snapshot
agent-browser diff screenshot --baseline before.png  # Visual pixel diff
agent-browser diff url <url1> <url2>                 # Compare two pages
```

## JavaScript Evaluation
```bash
agent-browser eval 'document.title'
agent-browser eval --stdin <<'EVALEOF'
JSON.stringify(Array.from(document.querySelectorAll("img")))
EVALEOF
```

## Streaming
```bash
agent-browser stream enable           # Start WebSocket streaming
agent-browser stream status           # Check streaming state
agent-browser stream disable          # Stop streaming
```
