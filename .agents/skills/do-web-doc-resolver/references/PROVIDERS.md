# Providers Reference

## URL Providers

| Provider | Free | API Key | Notes |
|----------|------|---------|-------|
| `llms_txt` | Yes | None | Fetches `/llms.txt`; high quality but limited coverage |
| `jina` | Yes | None | `https://r.jina.ai/{url}`; works on most static pages |
| `direct_fetch` | Yes | None | Simple HTTP GET; no JS rendering |
| `firecrawl` | Limited | `FIRECRAWL_API_KEY` | JS-heavy pages / SPAs; clean markdown |
| `mistral_browser` | No | `MISTRAL_API_KEY` | AI agent; handles complex layouts, higher latency |
| `docling` | Yes | None | Requires `docling` CLI; triggered by `.pdf`, `.docx`, `.pptx` URLs |
| `ocr` | Yes | None | Requires `tesseract`; triggered by `.png`, `.jpg`, `.jpeg` URLs |

```bash
# Install docling
pip install docling

# Install tesseract (Ubuntu/Debian)
sudo apt install tesseract-ocr
# macOS
brew install tesseract
```

## Query Providers

| Provider | Free | API Key | Notes |
|----------|------|---------|-------|
| `exa_mcp` | Yes | None | Exa MCP server; good quality, rate limited |
| `exa` | Limited | `EXA_API_KEY` | Exa SDK; autoprompt + highlights |
| `tavily` | Limited | `TAVILY_API_KEY` | Comprehensive search; depth options |
| `serper` | 2500 credits | `SERPER_API_KEY` | Google results via Serper |
| `duckduckgo` | Yes | None | Instant answers; always available fallback |
| `mistral_websearch` | No | `MISTRAL_API_KEY` | AI-synthesized results; higher latency |

## Rate Limits

| Provider | Rate Limit | Notes |
|----------|------------|-------|
| Exa MCP | Unknown | May vary |
| Exa SDK | Varies by plan | Check your plan |
| Tavily | Varies by plan | Check your plan |
| Serper | 2500/month free | Then paid |
| Jina | Generous | 429 triggers cooldown |
| Firecrawl | Varies by plan | Check your plan |
| DuckDuckGo | Moderate | Be respectful |
| Mistral | Varies by plan | Check your plan |

## Error Handling

| Error Type | Detection | Behavior |
|------------|-----------|----------|
| `rate_limit` | 429, "rate limit" | Set cooldown, skip provider |
| `auth_error` | 401, 403, "unauthorized" | Log error, skip provider |
| `quota_exhausted` | 402, "quota", "credits" | Log warning, skip provider |
| `network_error` | "timeout", "connection" | Log error, skip provider |
| `not_found` | 404, "not found" | Log error, skip provider |
| `provider_5xx` | 500-504 | Trip circuit breaker |

## Provider Selection

Providers are selected based on:

1. **Input type**: URL vs Query
2. **Budget constraints**: Profile settings (see SKILL.md Execution Profiles)
3. **Skip list**: Explicitly skipped providers
4. **Circuit breaker**: Provider health (3 failures → 300s cooldown)
5. **Routing memory**: Historical per-domain performance

### Example Selection Flow

```
Query: "Rust async runtime"
Profile: balanced

1. Cache check → Miss
2. Exa MCP → Try (free, first)
3. If quality < 0.65: Continue
4. Exa SDK → Try if API key + budget allows
5. If quality < 0.65: Continue
6. Tavily → Try if API key + budget allows
7. ...
8. DuckDuckGo → Always available fallback
```
