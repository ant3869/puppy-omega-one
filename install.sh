#!/usr/bin/env bash
# Install Puppy Omega One (Code Puppy edition) into a target project.
# Copies templates/ into the target, skips existing files unless --force,
# leaves the user's global Code Puppy configuration untouched, then prints setup instructions.
# Usage: ./install.sh [/path/to/project] [--force]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATES_DIR="$SCRIPT_DIR/templates"
TARGET="${1:-.}"
FORCE=0
[[ "${2:-}" == "--force" ]] && FORCE=1
[[ "${1:-}" == "--force" ]] && { TARGET="."; FORCE=1; }

if [[ ! -d "$TEMPLATES_DIR" ]]; then
  echo "templates/ not found next to this script ($TEMPLATES_DIR)." >&2
  exit 1
fi
TARGET="$(cd "$TARGET" && pwd)"

copied=0
skipped=0
while IFS= read -r -d '' src; do
  rel="${src#$TEMPLATES_DIR/}"
  dest="$TARGET/$rel"
  mkdir -p "$(dirname "$dest")"
  if [[ -e "$dest" && "$FORCE" -eq 0 ]]; then
    echo "  skip (exists): $rel"
    skipped=$((skipped + 1))
  else
    cp "$src" "$dest"
    copied=$((copied + 1))
  fi
done < <(find "$TEMPLATES_DIR" -type f -print0)

# Code Puppy reads ~/.code_puppy/puppy.cfg (or XDG_CONFIG_HOME/code_puppy/puppy.cfg),
# not a project-local puppy.cfg. Never silently change a user's global settings.

echo ""
echo "Puppy Omega One installed into $TARGET"
echo "  copied: $copied files, skipped: $skipped (already exist, use --force to overwrite)"
echo ""
echo "MANUAL STEPS (do these before your first real run):"
echo "  1. In Code Puppy at work, run /model and note the real Opus / Sonnet /"
echo "     Haiku alias strings. Swap them into .code_puppy/agents/*.json"
echo "     (the \"model\" field, one string per file). Aliases are PLACEHOLDERS:"
echo "     claude-opus-5-5 / claude-sonnet-5-5 / claude-haiku-5-5."
echo "  2. Optional: in Code Puppy, use /set compaction_threshold 0.5 and"
echo "     /set summarization_model <your real Haiku alias>. These are GLOBAL"
echo "     settings, not project settings. Check your existing values first."
echo "  3. Select the omega-orchestrator agent and confirm its Opus model."
echo "  4. VPN on if your Code Puppy models need it (Walmart build)."
echo ""
echo "Then open Code Puppy GUI in this project and run a job — see README.md"
echo "'Run a job' for the walkthrough."
