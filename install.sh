#!/usr/bin/env bash
# Install Omega project templates only. Never touch user-level Code Puppy files.
# Usage: ./install.sh [/path/to/project] [--force]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
TEMPLATES_DIR="$SCRIPT_DIR/templates"
TARGET="${1:-.}"
FORCE=0
[[ "${2:-}" == "--force" || "${1:-}" == "--force" ]] && FORCE=1
[[ "${1:-}" == "--force" ]] && TARGET="."

if [[ ! -d "$TEMPLATES_DIR" || ! -d "$TARGET" ]]; then
  echo "Expected templates/ and an existing project directory." >&2
  exit 1
fi
if [[ -L "$TARGET" ]]; then
  echo "Refusing a symlink as the project target." >&2
  exit 2
fi
TARGET="$(cd "$TARGET" && pwd -P)"
HOME="$(cd "$HOME" && pwd -P)"

under_or_above() {
  local test_path="${1%/}" guarded="${2%/}"
  [[ "$test_path" == "$guarded" || "$test_path" == "$guarded/"* || "$guarded" == "$test_path/"* ]]
}
protected_paths=(
  "$HOME/.code_puppy"
  "$HOME/.code-puppy-venv"
  "$HOME/.config/code_puppy"
  "$HOME/.config/code-puppy"
  "$HOME/puppy_gui"
  "$HOME/projects/puppy_gui"
)
if [[ -n "${XDG_CONFIG_HOME:-}" ]]; then
  protected_paths+=("$XDG_CONFIG_HOME/code_puppy" "$XDG_CONFIG_HOME/code-puppy")
fi
if [[ -n "${CODE_PUPPY_PYTHON:-}" && "$CODE_PUPPY_PYTHON" = /* ]]; then
  python_directory="$(dirname "$CODE_PUPPY_PYTHON")"
  case "$(basename "$python_directory" | tr '[:upper:]' '[:lower:]')" in
    bin|scripts) protected_paths+=("$(dirname "$python_directory")") ;;
    *) protected_paths+=("$python_directory") ;;
  esac
fi
if [[ -n "${PUPPY_GUI_LAUNCH:-}" && "$PUPPY_GUI_LAUNCH" = /* ]]; then
  protected_paths+=("$(dirname "$PUPPY_GUI_LAUNCH")")
fi
if [[ -n "${PUPPY_GUI_DIR:-}" && "$PUPPY_GUI_DIR" = /* ]]; then
  protected_paths+=("$PUPPY_GUI_DIR")
fi
# Project under HOME is fine; installation into HOME itself or its ancestor
# would write templates/.code_puppy into the user's global config tree.
if [[ "$TARGET" == "$HOME" || "$HOME" == "$TARGET/"* ]]; then
  echo "Refusing to install into or above the home directory: $TARGET" >&2
  exit 2
fi
for guarded in "${protected_paths[@]}"; do
  # Compare both the written path and its real location (global config may be a symlink).
  if [[ -d "$guarded" ]]; then
    canonical_guard="$(cd "$guarded" && pwd -P)"
  else
    canonical_guard="$guarded"
  fi
  if under_or_above "$TARGET" "$guarded" || under_or_above "$TARGET" "$canonical_guard"; then
    echo "Refusing protected Code Puppy path: $TARGET" >&2
    exit 2
  fi
done

# Preflight all paths before changing anything. Existing symlink directories
# could otherwise redirect an Omega project agent into global Code Puppy.
while IFS= read -r -d '' src; do
  rel="${src#"$TEMPLATES_DIR"/}"
  [[ -L "$src" ]] && { echo "Refusing template symlink: $rel" >&2; exit 2; }
  dest="$TARGET/$rel"
  if [[ -L "$dest" ]]; then
    echo "Refusing destination symlink: $rel" >&2
    exit 2
  fi
  current="$TARGET"
  IFS='/' read -r -a components <<< "$rel"
  for ((i = 0; i < ${#components[@]} - 1; i++)); do
    current+="/${components[i]}"
    if [[ -L "$current" || ( -e "$current" && ! -d "$current" ) ]]; then
      echo "Refusing redirected or non-directory destination: $current" >&2
      exit 2
    fi
  done
done < <(find "$TEMPLATES_DIR" -type f -print0)

copied=0
skipped=0
while IFS= read -r -d '' src; do
  rel="${src#"$TEMPLATES_DIR"/}"
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

echo ""
echo "Puppy Omega One installed into $TARGET"
echo "  copied: $copied files, skipped: $skipped (existing project files, use --force to overwrite)"
echo ""
echo "Only project templates were copied. Code Puppy core and user-level configuration were not modified."
echo "MANUAL STEPS:"
echo "  1. In Code Puppy, use /model to verify available model aliases."
echo "     Edit this project's .code_puppy/agents/*.json if needed."
echo "  2. Select omega-orchestrator and verify its configured model."
echo "  3. In Omega, attach to your existing Puppy GUI or explicitly launch it."
echo "  Optional global settings must be changed manually in Code Puppy."
