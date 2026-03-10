#!/usr/bin/env bash
# validate-on-write.sh — PostToolUse hook wrapper
#
# Routes file validation based on extension:
#   .liquid files → schema-validation.cjs
#   .html files → brand-compliance.cjs
#
# Reads JSON from stdin with tool_input containing file_path.
# Used as a Claude Code PostToolUse hook.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Read JSON from stdin
INPUT=$(cat)

# Extract file_path from tool_input JSON
FILE_PATH=$(echo "$INPUT" | grep -o '"file_path"\s*:\s*"[^"]*"' | head -1 | sed 's/.*"file_path"\s*:\s*"\([^"]*\)".*/\1/')

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Get file extension
EXT="${FILE_PATH##*.}"

case "$EXT" in
  liquid)
    node "$SCRIPT_DIR/schema-validation.cjs" "$FILE_PATH" 2>&1
    ;;
  html)
    node "$SCRIPT_DIR/brand-compliance.cjs" "$FILE_PATH" 2>&1
    ;;
  *)
    # Not a validatable file type — pass through silently
    exit 0
    ;;
esac
