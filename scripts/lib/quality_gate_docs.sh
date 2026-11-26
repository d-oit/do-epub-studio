#!/usr/bin/env bash
# Documentation, index and format phases of scripts/quality_gate.sh, sourced by
# it. Split out to keep quality_gate.sh under the 500-line cap (ADR-278); the
# gate itself is a live demo of the shrink-only ratchet. Expects REPO_ROOT,
# FAILED and the colour vars from the caller.

# FAILED is written here and read by the sourcing gate; shellcheck cannot
# follow it across the `source`, so scope the suppression here.
# shellcheck disable=SC2034

# --- Validate ADR index (ADR-083) ---
printf '%s  ✓ Validating ADR index (ADR-083)...%s\n' "${GREEN}" "${NC}"
if node "$REPO_ROOT/scripts/check-adr-index.mjs" 2>&1; then
  printf '%s  ✓ ADR index validation passed (ADR-083).%s\n' "${GREEN}" "${NC}"
else
  printf '%s  ✗ ADR index validation failed.%s\n' "${RED}" "${NC}"
  FAILED=1
fi
echo ""

# --- Validate plan/ADR references (ADR-083) ---
printf '%s  ✓ Validating plan references (ADR-083)...%s\n' "${GREEN}" "${NC}"
if node "$REPO_ROOT/scripts/check-plan-references.mjs" 2>&1; then
  printf '%s  ✓ Plan references resolved (ADR-083).%s\n' "${GREEN}" "${NC}"
else
  printf '%s  ✗ Plan reference validation failed.%s\n' "${RED}" "${NC}"
  FAILED=1
fi
echo ""

# --- Enforce 500-line source cap (ADR-278) ---
printf '%sValidating source line counts...%s\n' "${BLUE}" "${NC}"
if ! node "$REPO_ROOT/scripts/check-loc.mjs"; then FAILED=1; fi
echo ""

# --- Prettier format check (issue #1182) ---
# Enforced here rather than as a separate ci.yml step so local and CI run the
# identical command. Before #1182 this could not be a gate: the repo carried
# ~915 prettier-dirty files, so `format:check` failed on a clean checkout.
# Those files are now formatted, and .prettierignore keeps agent skills out
# (they are capped at 250 lines by MAX_LINES_SKILL_MD, and prettier's markdown
# output is net-line-positive — it broke that cap on a formatting-only commit).
printf '%sValidating Prettier formatting...%s\n' "${BLUE}" "${NC}"
if ! pnpm --dir "$REPO_ROOT" format:check; then FAILED=1; fi
echo ""

# --- Coverage threshold parity (ADR-282) ---
printf '%sValidating coverage threshold parity...%s\n' "${BLUE}" "${NC}"
if ! "$REPO_ROOT/scripts/validate-coverage-parity.sh"; then FAILED=1; fi
echo ""

# Run here as well as in CI so local and CI gate claims stay aligned. The shell
# wrapper checks local phases against the gate and its sourced phase libraries;
# the Node validator parses workflow YAML for real PR/release job contexts and
# checks readiness steps only within the configured release job.
printf '%sValidating gate parity manifest...%s\n' "${BLUE}" "${NC}"
if ! bash "$REPO_ROOT/scripts/validate-gate-parity.sh"; then FAILED=1; fi
echo ""

# --- Validate SKILL.md format ---
printf '%sValidating SKILL.md format...%s\n' "${BLUE}" "${NC}"
if [ ! -f "$REPO_ROOT/scripts/validate-skill-format.sh" ]; then
    printf '%s  ✗ scripts/validate-skill-format.sh not found — skill format check cannot run (required phase)%s\n' "${RED}" "${NC}"
    FAILED=1
elif ! "$REPO_ROOT/scripts/validate-skill-format.sh"; then
    FAILED=1
fi
echo ""

# --- Validate reference links in SKILL.md files ---
printf '%sValidating reference links in SKILL.md files...%s\n' "${BLUE}" "${NC}"
if [ ! -f "$REPO_ROOT/scripts/validate-links.sh" ]; then
    printf '%s  ✗ scripts/validate-links.sh not found — reference check cannot run (required phase)%s\n' "${RED}" "${NC}"
    FAILED=1
elif ! "$REPO_ROOT/scripts/validate-links.sh"; then
    FAILED=1
fi
echo ""

# --- skills-catalog freshness ---
printf '%sValidating skills-catalog freshness...%s\n' "${BLUE}" "${NC}"
if ! python3 "$REPO_ROOT/scripts/generate-available-skills.py" --check; then FAILED=1; fi
echo ""
