#!/bin/bash
# sync.sh — Distribute Fluid Creative OS skills to Claude Code and Cursor
# Usage: ./sync.sh [--target claude|cursor|both] [--dry-run] [--uninstall]
set -euo pipefail

# ──────────────────────────────────────────────
# CONFIG
# ──────────────────────────────────────────────
REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
CLAUDE_DIR="$HOME/.claude"
CURSOR_DIR="$HOME/.cursor"
NAMESPACE="fluid"

# Skills to distribute (relative to .claude/skills/)
SKILLS=("brand-intelligence" "brand-compliance-check" "scaffold-section")

# Parse arguments
TARGET="both"
DRY_RUN=false
UNINSTALL=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target)
      TARGET="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --uninstall)
      UNINSTALL=true
      shift
      ;;
    -h|--help)
      echo "Usage: ./sync.sh [--target claude|cursor|both] [--dry-run] [--uninstall]"
      echo ""
      echo "Options:"
      echo "  --target   Install to: claude, cursor, or both (default: both)"
      echo "  --dry-run  Show what would happen without making changes"
      echo "  --uninstall Remove all ${NAMESPACE}-* skills from target platforms"
      echo ""
      echo "This script installs Fluid Creative OS skills into Claude Code and/or Cursor."
      echo "It does NOT touch ~/.agents/ or global Claude Code commands."
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# ──────────────────────────────────────────────
# PREFLIGHT CHECKS
# ──────────────────────────────────────────────
if [ ! -d "$REPO_DIR/brand" ]; then
  echo "ERROR: brand/ directory not found at $REPO_DIR/brand"
  echo "Are you running sync.sh from the Fluid Creative OS repo root?"
  exit 1
fi

if [ ! -d "$REPO_DIR/tools" ]; then
  echo "WARNING: tools/ directory not found at $REPO_DIR/tools"
  echo "CLI tools may not be available yet. Continuing with skill installation."
fi

echo "=== Fluid Creative OS Sync ==="
echo "Repo:      $REPO_DIR"
echo "Target:    $TARGET"
echo "Dry run:   $DRY_RUN"
echo "Uninstall: $UNINSTALL"
echo ""

# Helper: execute or print (respects --dry-run)
run() {
  if [ "$DRY_RUN" = true ]; then
    echo "  [dry-run] $*"
  else
    "$@"
  fi
}

# Track what was done
INSTALLED=0
REMOVED=0

# ──────────────────────────────────────────────
# UNINSTALL
# ──────────────────────────────────────────────
if [ "$UNINSTALL" = true ]; then
  echo "--- Uninstalling ${NAMESPACE}-* skills ---"

  if [ "$TARGET" = "claude" ] || [ "$TARGET" = "both" ]; then
    echo ""
    echo "Claude Code:"
    for skill in "${SKILLS[@]}"; do
      link="$CLAUDE_DIR/skills/${NAMESPACE}-${skill}"
      if [ -L "$link" ] || [ -d "$link" ]; then
        echo "  Removing: $link"
        run rm -rf "$link"
        ((REMOVED++))
      else
        echo "  Not found: $link (skipping)"
      fi
    done
  fi

  if [ "$TARGET" = "cursor" ] || [ "$TARGET" = "both" ]; then
    echo ""
    echo "Cursor:"
    for skill in "${SKILLS[@]}"; do
      dir="$CURSOR_DIR/skills/${NAMESPACE}-${skill}"
      if [ -d "$dir" ]; then
        echo "  Removing: $dir"
        run rm -rf "$dir"
        ((REMOVED++))
      else
        echo "  Not found: $dir (skipping)"
      fi
    done
  fi

  echo ""
  echo "=== Uninstall Complete ==="
  echo "Removed: $REMOVED items"
  exit 0
fi

# ──────────────────────────────────────────────
# INSTALL: CLAUDE CODE
# ──────────────────────────────────────────────
if [ "$TARGET" = "claude" ] || [ "$TARGET" = "both" ]; then
  echo "--- Claude Code ---"
  echo ""
  echo "Primary: Add this repo as an additional directory in Claude Code:"
  echo "  claude --add-dir $REPO_DIR"
  echo "  (Skills in .claude/skills/ are auto-discovered with hot reload)"
  echo ""
  echo "Fallback: Symlinking skills with ${NAMESPACE}- prefix..."

  run mkdir -p "$CLAUDE_DIR/skills"

  for skill in "${SKILLS[@]}"; do
    src="$REPO_DIR/.claude/skills/$skill"
    dst="$CLAUDE_DIR/skills/${NAMESPACE}-${skill}"

    if [ ! -d "$src" ]; then
      echo "  SKIP: $src (not found)"
      continue
    fi

    # Remove stale symlink or directory
    if [ -L "$dst" ] || [ -d "$dst" ]; then
      run rm -rf "$dst"
    fi

    echo "  Symlink: $dst -> $src"
    run ln -sfn "$src" "$dst"
    ((INSTALLED++))
  done

  echo ""
  echo "  Note: .claude/settings.json hooks are project-scoped (auto-loaded when"
  echo "  working in this repo). No global hook installation needed."
fi

# ──────────────────────────────────────────────
# INSTALL: CURSOR
# ──────────────────────────────────────────────
if [ "$TARGET" = "cursor" ] || [ "$TARGET" = "both" ]; then
  echo ""
  echo "--- Cursor ---"

  run mkdir -p "$CURSOR_DIR/skills"

  for skill in "${SKILLS[@]}"; do
    src="$REPO_DIR/.claude/skills/$skill"
    dst="$CURSOR_DIR/skills/${NAMESPACE}-${skill}"

    if [ ! -d "$src" ]; then
      echo "  SKIP: $src (not found)"
      continue
    fi

    # Create directory and copy files
    run mkdir -p "$dst"

    if [ "$DRY_RUN" = true ]; then
      echo "  [dry-run] cp $src/SKILL.md $dst/SKILL.md"
    else
      cp "$src/SKILL.md" "$dst/SKILL.md"
    fi

    echo "  Copied: $dst"
    ((INSTALLED++))
  done
fi

# ──────────────────────────────────────────────
# REPORT
# ──────────────────────────────────────────────
echo ""
echo "=== Sync Complete ==="
echo "Installed: $INSTALLED skill links/copies"
echo ""
echo "Verify:"
if [ "$TARGET" = "claude" ] || [ "$TARGET" = "both" ]; then
  echo "  ls ~/.claude/skills/ | grep ${NAMESPACE}"
fi
if [ "$TARGET" = "cursor" ] || [ "$TARGET" = "both" ]; then
  echo "  ls ~/.cursor/skills/ | grep ${NAMESPACE}"
fi
echo ""
echo "Important: This script does NOT modify ~/.agents/ or global Claude Code commands."
echo "Your existing global skills are untouched."
