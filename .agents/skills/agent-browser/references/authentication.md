# Authentication Patterns

Login flows, session persistence, and authenticated browsing for agent-browser.

**Related**: [session-management.md](session-management.md) for state persistence details, [SKILL.md](../SKILL.md) for quick start.

<!-- See full upstream auth docs at https://github.com/browserbase/agent-browser for OAuth/SSO, 2FA, HTTP Basic Auth, Cookie-Based Auth, and Token Refresh patterns -->

## Import Auth from Your Browser

The fastest way to authenticate is to reuse cookies from a Chrome session you are already logged into.

**Step 1: Start Chrome with remote debugging**

```bash
# macOS
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --remote-debugging-port=9222

# Linux
google-chrome --remote-debugging-port=9222
```

Log in to your target site(s) in this Chrome window as you normally would.

> **Security note:** `--remote-debugging-port` exposes full browser control on localhost. Only use on trusted machines.

**Step 2: Grab the auth state**

```bash
agent-browser --auto-connect state save ./my-auth.json
```

**Step 3: Reuse in automation**

```bash
agent-browser --state ./my-auth.json open https://app.example.com/dashboard
```

> **Security note:** State files contain session tokens in plaintext. Add them to `.gitignore` and set `AGENT_BROWSER_ENCRYPTION_KEY` for encryption at rest.

**Tip:** Combine with `--session-name` for auto-persistence:

```bash
agent-browser --session-name myapp state load ./my-auth.json
```

## Persistent Profiles

Use `--profile` to point agent-browser at a Chrome user data directory. Persists cookies, IndexedDB, and service workers across restarts:

```bash
# First run: login once
agent-browser --profile ~/.myapp-profile open https://app.example.com/login

# All subsequent runs: already authenticated
agent-browser --profile ~/.myapp-profile open https://app.example.com/dashboard
```

```bash
export AGENT_BROWSER_PROFILE=~/.myapp-profile
agent-browser open https://app.example.com/dashboard
```

## Session Persistence

Use `--session-name` to auto-save and restore cookies + localStorage by name:

```bash
agent-browser --session-name twitter open https://twitter.com
agent-browser close  # state saved to ~/.agent-browser/sessions/

# Next time: state is automatically restored
agent-browser --session-name twitter open https://twitter.com
```

Encrypt state at rest:

```bash
export AGENT_BROWSER_ENCRYPTION_KEY=$(openssl rand -hex 32)
agent-browser --session-name secure open https://app.example.com
```

## Basic Login Flow

```bash
agent-browser open https://app.example.com/login
agent-browser snapshot -i
# @e1 [input type="email"], @e2 [input type="password"], @e3 [button] "Sign In"

agent-browser fill @e1 "user@example.com"
agent-browser fill @e2 "password123"
agent-browser click @e3
agent-browser wait --load networkidle

# Verify login succeeded
agent-browser get url  # Should be dashboard, not login
```

## Saving and Restoring Authentication

```bash
# After a successful login, save state
agent-browser state save ./auth-state.json

# Skip login by loading saved state
agent-browser state load ./auth-state.json
agent-browser open https://app.example.com/dashboard
```

## Security Best Practices

1. **Never commit state files** — they contain session tokens

   ```bash
   echo "*.auth-state.json" >> .gitignore
   ```

2. **Use environment variables for credentials**

   ```bash
   agent-browser fill @e1 "$APP_USERNAME"
   agent-browser fill @e2 "$APP_PASSWORD"
   ```

3. **Clean up after automation**

   ```bash
   agent-browser cookies clear
   rm -f ./auth-state.json
   ```

4. **Use short-lived sessions for CI/CD** — don't persist state; close the session when done
