# CLI Reference

## Python CLI (`scripts/cli.py`)

### Basic Usage

```bash
# Resolve a URL
python scripts/cli.py "https://docs.rs/tokio"

# Resolve a query
python scripts/cli.py "Rust async runtime comparison"

# JSON output
python scripts/cli.py "query" --json

# Specify max characters
python scripts/cli.py "query" --max-chars 5000
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--max-chars` | int | 8000 | Maximum characters in output |
| `--json` | flag | false | Output as JSON |
| `--profile` | string | balanced | Execution profile (free/fast/balanced/quality) |
| `--skip` | string[] | none | Provider(s) to skip |
| `--provider` | string | none | Use specific provider only |
| `--providers-order` | string | none | Comma-separated provider order |
| `--log-level` | string | INFO | Log level (DEBUG/INFO/WARNING/ERROR) |

### Advanced Controls

- `--max-provider-attempts <N>`: Max providers to try in the cascade.
- `--max-paid-attempts <N>`: Max paid providers to attempt.
- `--max-total-latency-ms <MS>`: Hard timeout for the entire resolution process.
- `--min-chars <N>`: Minimum content length for a successful result.
- `--quality-threshold <F>`: Minimum quality score (0.0–1.0).
- `--metrics-file <PATH>`: Save resolution metrics to a JSON file.
- `--skip-cache`: Bypass both traditional and semantic caches.
- `--disable-routing-memory`: Do not use or update domain-level performance memory.

### Skip / Select Providers

```bash
python scripts/cli.py "query" --skip exa_mcp --skip exa
python scripts/cli.py "query" --provider duckduckgo
python scripts/cli.py "query" --providers-order "exa,jina,duckduckgo"
```

## Rust CLI (`do-wdr`)

<!-- Full Rust CLI reference: references/RUST_CLI.md -->

```bash
do-wdr resolve "https://docs.rs/tokio"
do-wdr resolve "Rust async runtime" --profile fast --json
do-wdr providers  # list available providers
```

## Python Module API

```python
from scripts.resolve import resolve, resolve_url, resolve_query, resolve_direct, resolve_with_order

result = resolve("https://example.com")          # auto-detect URL vs query
result = resolve_url("https://docs.rs/tokio", max_chars=5000)
result = resolve_query("Rust web frameworks", skip_providers={"exa_mcp"})

from scripts.models import Profile
result = resolve("query", profile=Profile.QUALITY)

from scripts.models import ProviderType
result = resolve_direct("query", ProviderType.DUCKDUCKGO)
result = resolve_with_order("query", [ProviderType.EXA_MCP, ProviderType.DUCKDUCKGO])
```

### Response Structure

```python
{
    "url": "https://example.com/docs",   # Original URL (if URL input)
    "query": "search query",             # Original query (if query input)
    "content": "# Documentation\n\n...", # Markdown content
    "source": "exa_mcp",                 # Provider that succeeded
    "score": 0.87,                       # Quality score (0.0-1.0)
    "metrics": {
        "total_latency_ms": 1234,
        "cascade_depth": 1,
        "paid_usage": False,
        "cache_hit": False
    }
}
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `WEB_RESOLVER_MAX_CHARS` | 8000 | Maximum output characters |
| `WEB_RESOLVER_MIN_CHARS` | 200 | Minimum characters for valid result |
| `WEB_RESOLVER_TIMEOUT` | 30 | Request timeout in seconds |
| `WEB_RESOLVER_CACHE_DIR` | ~/.cache/do-web-doc-resolver | Cache directory |
| `WEB_RESOLVER_CACHE_TTL` | 86400 | Cache TTL in seconds (24h) |
| `WEB_RESOLVER_EXA_RESULTS` | 5 | Max Exa results |
| `WEB_RESOLVER_TAVILY_RESULTS` | 5 | Max Tavily results |
| `WEB_RESOLVER_DDG_RESULTS` | 5 | Max DuckDuckGo results |
