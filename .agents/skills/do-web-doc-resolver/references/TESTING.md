# Testing Reference

## Overview

The skill ships Python unit/integration tests. Run these before committing changes to the skill.

<!-- Rust CLI tests, E2E Playwright tests, and full quality-gate scripts live in the upstream repo: https://github.com/d-oit/do-web-doc-resolver -->

## Python Tests

### Location

```
tests/
├── conftest.py           # Shared fixtures
├── test_resolve.py       # Main resolver tests
├── test_providers.py     # Provider-specific tests
├── test_quality.py       # Quality scoring tests
├── test_routing.py       # Routing logic tests
├── test_circuit_breaker.py # Circuit breaker tests
├── test_utils.py         # Utility function tests
└── test_cache.py         # Caching tests
```

### Running Tests

```bash
# Run all non-live tests (no API keys needed)
python -m pytest tests/ -v -m "not live"

# Run specific test file
python -m pytest tests/test_resolve.py -v

# Run with coverage
python -m pytest tests/ -v --cov=scripts --cov-report=html

# Run live integration tests (requires API keys)
python -m pytest tests/ -m live -v
```

### Test Markers

| Marker | Description | Requirements |
|--------|-------------|--------------|
| `not live` | Unit tests, no external calls | None |
| `live` | Integration tests with real APIs | API keys |
| `slow` | Tests that take > 1s | None |
| `exa` | Exa provider tests | `EXA_API_KEY` |
| `tavily` | Tavily provider tests | `TAVILY_API_KEY` |
| `firecrawl` | Firecrawl tests | `FIRECRAWL_API_KEY` |
| `mistral` | Mistral tests | `MISTRAL_API_KEY` |

### Example Test

```python
import pytest
from scripts.resolve import resolve, resolve_query
from scripts.models import Profile


@pytest.fixture
def mock_exa_mcp(monkeypatch):
    """Mock Exa MCP responses."""
    def mock_resolve(*args, **kwargs):
        from scripts.models import ResolvedResult
        return ResolvedResult(
            source="exa_mcp",
            content="# Test Result\n\nMock content here.",
            query=args[0] if args else kwargs.get("query"),
        )
    monkeypatch.setattr("scripts.providers_impl.resolve_with_exa_mcp", mock_resolve)


def test_resolve_query_basic(mock_exa_mcp):
    """Test basic query resolution."""
    result = resolve_query("test query")
    assert result["source"] == "exa_mcp"
    assert "Test Result" in result["content"]


def test_resolve_url_is_url():
    """Test URL detection."""
    from scripts.utils import is_url
    assert is_url("https://example.com") is True
    assert is_url("not a url") is False


@pytest.mark.live
@pytest.mark.exa
def test_resolve_live_exa():
    """Live test with Exa API."""
    result = resolve("Rust programming language")
    assert result["source"] != "none"
    assert len(result["content"]) > 100
```

### Key Fixtures (conftest.py)

```python
@pytest.fixture
def temp_cache_dir():
    """Create a temporary cache directory."""
    with tempfile.TemporaryDirectory() as tmpdir:
        old_dir = os.environ.get("WEB_RESOLVER_CACHE_DIR")
        os.environ["WEB_RESOLVER_CACHE_DIR"] = tmpdir
        yield tmpdir
        if old_dir:
            os.environ["WEB_RESOLVER_CACHE_DIR"] = old_dir
        else:
            del os.environ["WEB_RESOLVER_CACHE_DIR"]


@pytest.fixture
def reset_circuit_breakers():
    """Reset circuit breaker state between tests."""
    from scripts.resolve import _circuit_breakers
    _circuit_breakers.breakers.clear()
    yield
    _circuit_breakers.breakers.clear()
```

## Quick Quality Gate

```bash
# Python tests + lint
python -m pytest tests/ -v -m "not live"
ruff check scripts/ tests/
black --check scripts/ tests/
```
