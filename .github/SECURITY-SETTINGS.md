# GitHub Security Configuration

This document outlines the 2026 best practice security settings for the repository.

## Repository Settings (2026 Best Practices)

### Branch Protection Rules

**Rulesets (Preferred over legacy branch protection):**

1. Navigate to: Repository Settings → Rules → Rulesets
2. Create ruleset for `main` branch with:
   - ✅ Require pull request (1 approval minimum)
   - ✅ Dismiss stale reviews
   - ✅ Require status checks to pass
   - ✅ Require up-to-date branches
   - ✅ Require code owner reviews
   - ✅ Block force pushes
   - ✅ Include administrators

### Security & Analysis Features

Enable in Repository Settings → Code security and analysis:

| Feature | Status | Notes |
|---------|--------|-------|
| Dependency graph | ✅ On | Free |
| Dependabot alerts | ✅ On | Free |
| Dependabot security updates | ✅ On | Free |
| Secret scanning | ✅ On | Requires Secret Protection (Team) |
| Push protection | ✅ On | Block secrets on push |
| Code scanning | ✅ On | Default CodeQL setup |
| Dependency review action | ✅ On | Reviews PR dependencies |

### Access Control

- Default branch: `main`
- Repository visibility: Private
- Forking: Disabled for private repos
- Squash merging: Enabled (clean history)

### Commit Protection

- Require signed commits (GPG/SSH)
- Require commit sign-off (DCO)
- Block secret pushes

### Actions Settings

- ✅ Require workflow approval
- Set workflow permissions: Read-only
- Disable GitHub Actions for forks (if not needed)

### Secrets Management

- ✅ Enable secret scanning alerts
- ✅ Enable push protection
- Use GitHub Secrets (not env files in repo)
- Rotate secrets regularly

### CODEOWNERS

Maintain `.github/CODEOWNERS`:
```
# Default reviewers
* @default-reviewer

# Security-critical paths
/src/auth/** @security-owner
/src/security/** @security-owner
/.github/workflows/** @ci-owner
```

### Organization-Level (If Applicable)

If part of GitHub organization:

1. **Authentication Security:**
   - Require 2FA for all members
   - Set base permissions to "No permission" or "Read"
   - Restrict repository creation to admins only

2. **Personal Access Tokens:**
   - Restrict classic PATs
   - Require approval for fine-grained PATs
   - Set max token lifetime: 90 days

3. **Member Privileges:**
   - Disable public repository creation
   - Disable private forking
   - Require SAML SSO (Enterprise)

---

## Enforcement Commands

### CLI (gh)

```bash
# Enable branch protection
gh api -X PUT /repos/OWNER/REPO/branches/main/protection \
  -f require_signed_commits=true \
  -f required_pull_request_reviews.required_approving_review_count=1 \
  -f enforce_admins=true

# Enable security features
gh api -X PATCH /repos/OWNER/REPO \
  -f security_and_analysis.advanced_security=active \
  -f security_and_analysis.secret_scanning=active
```

### Terraform

```hcl
resource "github_branch_protection" "main" {
  repository_id       = github_repository.main.id
  pattern             = "main"
  enforce_admins      = true
  require_signed_commits = true

  required_pull_request_reviews {
    required_approving_review_count = 1
    dismiss_stale_reviews           = true
    require_code_owner_reviews      = true
  }
}
```

---

## Validation Checklist

- [ ] Branch protection enabled on `main`
- [ ] Require PR before merge
- [ ] Require approvals (min 1)
- [ ] Require status checks
- [ ] Include administrators in protection
- [ ] Security features enabled
- [ ] CODEOWNERS file exists
- [ ] 2FA enabled for all contributors
- [ ] No secrets in commit history
- [ ] Secrets scanning enabled

---

## Monitoring

Set up alerts for:
- Branch protection changes
- New secrets detected
- Dependabot vulnerabilities
- Failed security scans

```bash
# Check audit log
gh api /orgs/OWNER/audit-log --jq '.[] | select(.action | startswith("protected_branch"))'
```
