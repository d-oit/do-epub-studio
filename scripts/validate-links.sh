#!/usr/bin/env bash
# Validates reference links in SKILL.md files.
# Checks that all markdown links point to existing files.
# Checks for consistent reference format: `references?/filename.md` - Description
# Exit 0 if all links valid, non-zero if broken links or format errors found.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# Source shared libs
# shellcheck source=scripts/lib/colors.sh
source "$REPO_ROOT/scripts/lib/colors.sh"

SKILLS_DIR="$REPO_ROOT/.agents/skills"

BROKEN_COUNT=0
FORMAT_ERRORS=0
FILES_CHECKED=0
LINKS_CHECKED=0

LINK_REGEX='\[([^]]+)\]\(([^)]+)\)'
AT_REF_REGEX='@references?/[^[:space:]]+'
PROPER_REF_REGEX='^\-[[:space:]]+\`(references?/[a-zA-Z0-9_-]+\.md)\`[[:space:]]*-[[:space:]]+.+$'

is_references_header() {
    [[ "$1" =~ ^##[[:space:]]+[Rr]eferences ]]
}

is_section_header() {
    [[ "$1" =~ ^##[[:space:]]+ ]] && ! [[ "$1" =~ ^##[[:space:]]+[Rr]eferences ]]
}

is_url() {
    [[ "$1" =~ ^https?:// ]] || [[ "$1" =~ ^ftp:// ]] || [[ "$1" =~ ^mailto: ]]
}

# Portable path resolution — handles macOS (no realpath -m) and Linux
resolve_path() {
    local base_dir="$1"
    local link_path="$2"

    if [[ "$link_path" == /* ]]; then
        echo "$link_path"
        return
    fi

    local combined="$base_dir/$link_path"

    # Try realpath first (GNU), fall back to manual normalization
    if command -v realpath &> /dev/null; then
        realpath -m "$combined" 2>/dev/null || echo "$combined"
    elif command -v readlink &> /dev/null; then
        # macOS readlink -f doesn't exist; use perl as fallback
        perl -MCwd=abs_path -le 'print abs_path($ARGV[0])' "$combined" 2>/dev/null || echo "$combined"
    else
        echo "$combined"
    fi
}

check_link() {
    local skill_dir="$1"
    local link_path="$2"
    local skill_file="$3"
    local line_num="$4"

    if is_url "$link_path"; then
        return 0
    fi

    if [[ "$link_path" == \#* ]]; then
        return 0
    fi

    if [[ "$link_path" =~ ^(image-url|example|placeholder|your-file|path/to) ]]; then
        return 0
    fi

    local clean_path="${link_path%%#*}"
    local full_path
    full_path="$(resolve_path "$skill_dir" "$clean_path")"

    if [[ ! -e "$full_path" && ! -L "$full_path" ]]; then
        echo -e "  ${RED}✗${NC} Broken link at line $line_num: \`${clean_path}'" >&2
        echo -e "     in: $skill_file" >&2
        return 1
    fi

    return 0
}

check_reference_format() {
    local line="$1"
    local line_num="$2"
    local skill_file="$3"
    local skill_dir="$4"

    [[ -z "$line" ]] && return 0
    [[ "$line" =~ ^## ]] && return 0
    [[ "$line" =~ ^\| ]] && return 0

    if [[ "$line" =~ $AT_REF_REGEX ]]; then
        local bad_ref="${BASH_REMATCH[0]}"
        echo -e "  ${RED}✗${NC} Invalid reference format at line $line_num" >&2
        echo -e "     Found: $bad_ref" >&2
        echo -e "     Use: \`references?/filename.md\` - Description" >&2
        echo -e "     in: $skill_file" >&2
        return 1
    fi

    if [[ "$line" =~ ^-[[:space:]] ]]; then
        if ! [[ "$line" =~ $PROPER_REF_REGEX ]]; then
            if [[ "$line" =~ \[.+\]\((references?/.+)\) ]]; then
                local link_path="${BASH_REMATCH[1]}"
                echo -e "  ${RED}✗${NC} Invalid reference format at line $line_num" >&2
                echo -e "     Found: Markdown link [text]($link_path)" >&2
                echo -e "     Use: \`$link_path\` - Description" >&2
                echo -e "     in: $skill_file" >&2
                return 1
            fi
        fi
    fi

    return 0
}

process_skill_file() {
    local skill_file="$1"
    local skill_dir
    skill_dir="$(dirname "$skill_file")"

    FILES_CHECKED=$((FILES_CHECKED + 1))

    local line_num=0
    local file_broken=0
    local file_format_errors=0
    local in_references=0

    while IFS= read -r line; do
        line_num=$((line_num + 1))

        if is_references_header "$line"; then
            in_references=1
            continue
        elif is_section_header "$line"; then
            in_references=0
        fi

        if [[ $in_references -eq 1 ]]; then
            if ! check_reference_format "$line" "$line_num" "$skill_file" "$skill_dir"; then
                FORMAT_ERRORS=$((FORMAT_ERRORS + 1))
                file_format_errors=1
            fi
        fi

        # Extract markdown links one at a time
        local temp_line="$line"
        while [[ "$temp_line" =~ $LINK_REGEX ]]; do
            local link_text="${BASH_REMATCH[1]}"
            local link_path="${BASH_REMATCH[2]}"
            # Advance past this match to find next ones
            temp_line="${temp_line#*"]($link_path)"}"

            if [[ "$link_text" =~ example ]] || [[ "$link_path" =~ \.(svg|png|jpg|jpeg|gif)$ ]]; then
                continue
            fi

            LINKS_CHECKED=$((LINKS_CHECKED + 1))

            if ! check_link "$skill_dir" "$link_path" "$skill_file" "$line_num"; then
                BROKEN_COUNT=$((BROKEN_COUNT + 1))
                file_broken=1
            fi
        done

        # Check for backtick references
        if [[ "$line" =~ \`(references?/[a-zA-Z0-9_-]+\.md)\` ]]; then
            local ref_path="${BASH_REMATCH[1]}"
            LINKS_CHECKED=$((LINKS_CHECKED + 1))
            if ! check_link "$skill_dir" "$ref_path" "$skill_file" "$line_num"; then
                BROKEN_COUNT=$((BROKEN_COUNT + 1))
                file_broken=1
            fi
        fi

        # Deprecated @reference prefix
        if [[ "$line" =~ @(references?/[a-zA-Z0-9_-]+\.md) ]]; then
            local at_ref="${BASH_REMATCH[1]}"
            echo -e "  ${RED}✗${NC} Broken @reference at line $line_num: @$at_ref" >&2
            echo -e "     @ prefix is deprecated. Use: \`reference/filename.md\`" >&2
            echo -e "     in: $skill_file" >&2
            BROKEN_COUNT=$((BROKEN_COUNT + 1))
            file_broken=1
        fi
    done < "$skill_file"

    if [[ $file_broken -eq 0 && $file_format_errors -eq 0 ]]; then
        echo -e "  ${GREEN}✓${NC} $(basename "$skill_dir"): All links valid"
    fi
}

echo "Validating reference links in SKILL.md files..."
echo ""

if [[ ! -d "$SKILLS_DIR" ]]; then
    echo -e "${YELLOW}⚠${NC} Skills directory not found: $SKILLS_DIR"
    exit 0
fi

for skill_path in "$SKILLS_DIR"/*/; do
    [[ -d "$skill_path" ]] || continue
    skill_name="$(basename "$skill_path")"
    [[ "$skill_name" == _* ]] && continue
    skill_file="$skill_path/SKILL.md"
    if [[ ! -f "$skill_file" ]]; then
        echo -e "  ${YELLOW}⚠${NC} $skill_name: Missing SKILL.md"
        continue
    fi
    process_skill_file "$skill_file"
done

echo ""
echo "─────────────────────────────────────────────────────────────────"

TOTAL_ERRORS=$((BROKEN_COUNT + FORMAT_ERRORS))

if [[ $TOTAL_ERRORS -gt 0 ]]; then
    echo "│ ${RED}✗ Link Validation FAILED${NC}                                      │" >&2
    echo "─────────────────────────────────────────────────────────────────" >&2
    echo "" >&2
    echo "  Files checked: $FILES_CHECKED" >&2
    echo "  Links checked: $LINKS_CHECKED" >&2
    echo -e "  ${RED}Broken links: $BROKEN_COUNT${NC}" >&2
    echo -e "  ${RED}Format errors: $FORMAT_ERRORS${NC}" >&2
    exit 1
else
    echo -e "│ ${GREEN}✓ All reference links valid${NC}                                   │"
    echo "─────────────────────────────────────────────────────────────────"
    echo ""
    echo "  Files checked: $FILES_CHECKED"
    echo "  Links checked: $LINKS_CHECKED"
    echo "  Broken links: 0"
    exit 0
fi
