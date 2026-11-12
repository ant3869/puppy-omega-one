#!/usr/bin/env bash
# Install Puppy Omega One (Code Puppy edition) into a target project.
# Copies templates/ into the target, skips existing files unless --force,
# sets puppy.cfg compaction_threshold=0.5 and summarization_model to the
# Haiku placeholder, then prints the manual steps.
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

# --- puppy.cfg: append only missing defaults; never overwrite verified settings ---
CFG_PATH="$TARGET/puppy.cfg"
touch "$CFG_PATH"
set_cfg_key() {
  local key="$1" value="$2" file="$3"
  if ! grep -q "^[[:space:]]*$key[[:space:]]*=" "$file"; then
    printf '%s=%s\n' "$key" "$value" >> "$file"
  fi
}
set_cfg_key "compaction_threshold" "0.5" "$CFG_PATH"

echo ""
echo "Puppy Omega One installed into $TARGET"
echo "  copied: $copied files, skipped: $skipped (already exist, use --force to overwrite)"
echo "  puppy.cfg: compaction_threshold added only if missing; existing settings preserved."
echo ""
echo "MANUAL STEPS (do these before your first real run):"
echo "  1. In Code Puppy at work, run /model and note the real Opus / Sonnet /"
echo "     Haiku alias strings. Swap them into .code_puppy/agents/*.json"
echo "     (the \"model\" field, one string per file) and puppy.cfg"
echo "     (summarization_model — set it manually once verified). The aliases are PLACEHOLDERS:"
echo "     claude-opus-5-5 / claude-sonnet-5-5 / claude-haiku-5-5."
echo "  2. Set the global model to your Opus alias, or start the session on"
echo "     the omega-orchestrator agent."
echo "  3. VPN on if your Code Puppy models need it (Walmart build)."
echo ""
echo "Then open Code Puppy GUI in this project and run a job — see README.md"
echo "'Run a job' for the walkthrough."
