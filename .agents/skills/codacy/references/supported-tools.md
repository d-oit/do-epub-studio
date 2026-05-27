# Supported Codacy Tools

Codacy supports hundreds of tools, but only a subset are available in the local Analysis CLI.

## Local Analysis CLI Support (Common Tools)

| Tool | Language | Status |
|------|----------|--------|
| ESLint | JavaScript/TypeScript | ✅ Supported |
| Stylelint | CSS/SCSS | ✅ Supported |
| ShellCheck | Shell | ✅ Supported |
| Trivy | Security/IAC | ✅ Supported |
| markdownlint | Markdown | ✅ Supported |
| Bandit | Python | ❌ Fails (venv) |
| Pylint | Python | ❌ Fails (venv) |
| PMD | Java | ❌ Fails (Java) |

## Cloud Analysis

The Codacy Cloud (Remote) analysis runs all enabled tools in the Codacy dashboard regardless of local runtime availability. Always use `codacy pull-request` to see the authoritative list of issues.
