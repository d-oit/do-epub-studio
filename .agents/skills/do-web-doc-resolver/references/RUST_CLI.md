# Rust CLI Reference

The Rust CLI (`do-wdr`) is a compiled binary for fast, dependency-free resolution. It implements the same cascade logic as the Python resolver with better performance.

<!-- Full Rust architecture, provider trait API, and source layout: https://github.com/d-oit/do-web-doc-resolver -->

## Building

```bash
cd cli
cargo build --release
# Binary: cli/target/release/do-wdr (Linux/macOS) or cli/target/release/do-wdr.exe (Windows)
```

Requirements: Rust 1.70+ stable, `cargo`.

## Basic Usage

```bash
# Resolve URL
do-wdr resolve "https://docs.rs/tokio"

# Resolve query
do-wdr resolve "Rust async runtime"

# JSON output
do-wdr resolve "query" --json

# With options
do-wdr resolve "query" --max-chars 5000 --profile quality
```

## CLI Options

```
USAGE:
    do-wdr [OPTIONS] <COMMAND>

COMMANDS:
    resolve      Resolve a URL or query to markdown documentation
    providers    List available providers
    config       Show configuration
    cache-stats  Show cache statistics

RESOLVE OPTIONS:
        --max-chars <NUM>          Maximum characters in output [default: 8000]
        --json                     Output as JSON
    -p, --profile <PROFILE>        Execution profile [default: balanced]
                                   [possible: free, fast, balanced, quality]
        --skip <PROVIDERS>         Skip providers (comma-separated)
        --provider <NAME>          Use specific provider only
    -o, --output <FILE>            Output file
        --quality-threshold <F>    Quality threshold
        --metrics-json             Output metrics as JSON
    -v, --verbose                  Verbose logging (-v, -vv, -vvv)
```

## Examples

```bash
do-wdr resolve "React hooks tutorial" --profile fast
do-wdr resolve "quantum computing" --profile quality --max-chars 10000
do-wdr resolve "Python async" --profile free
do-wdr resolve "query" --skip exa,tavily
do-wdr resolve "query" --provider duckduckgo
do-wdr -vv resolve "query"
```

## Configuration

Config file locations:
- Linux/macOS: `~/.config/do-wdr/config.toml`
- Windows: `%APPDATA%\do-wdr\config.toml`

```toml
[defaults]
max_chars = 8000
timeout = 30
profile = "balanced"

[cache]
enabled = true
ttl_hours = 24
path = "~/.cache/do-wdr"

[circuit_breaker]
failure_threshold = 3
cooldown_seconds = 300

[providers]
exa_api_key = "your-key"
tavily_api_key = "your-key"
```

## Performance vs Python

| Metric | Python | Rust |
|--------|--------|------|
| Startup time | ~200ms | ~5ms |
| Memory (idle) | ~50MB | ~5MB |
| Binary size | N/A | ~15MB |

## Testing

```bash
cargo test
cargo test test_resolve_url
cargo test -- --nocapture
cargo test --features integration  # requires API keys
```
