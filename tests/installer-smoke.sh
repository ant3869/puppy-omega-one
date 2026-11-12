#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$TMP/existing" "$TMP/fresh"
printf 'compaction_threshold=0.75\nsummarization_model=company-verified\n' > "$TMP/existing/puppy.cfg"
printf 'leave this file untouched\n' > "$TMP/existing/AGENTS.md"

bash "$ROOT/install.sh" "$TMP/existing" >/dev/null
grep -qx 'compaction_threshold=0.75' "$TMP/existing/puppy.cfg"
grep -qx 'summarization_model=company-verified' "$TMP/existing/puppy.cfg"
grep -qx 'leave this file untouched' "$TMP/existing/AGENTS.md"
test -f "$TMP/existing/.code_puppy/agents/omega-builder-agent.json"
test -f "$TMP/existing/.claude/commands/omega-brief.md"

bash "$ROOT/install.sh" "$TMP/existing" >/dev/null
test "$(grep -c '^compaction_threshold=' "$TMP/existing/puppy.cfg")" -eq 1
test "$(grep -c '^summarization_model=' "$TMP/existing/puppy.cfg")" -eq 1

bash "$ROOT/install.sh" "$TMP/existing" --force >/dev/null
grep -qx 'compaction_threshold=0.75' "$TMP/existing/puppy.cfg"
grep -qx 'summarization_model=company-verified' "$TMP/existing/puppy.cfg"
grep -q '^# AGENTS.md' "$TMP/existing/AGENTS.md"

bash "$ROOT/install.sh" "$TMP/fresh" >/dev/null
grep -qx 'compaction_threshold=0.5' "$TMP/fresh/puppy.cfg"
if grep -q '^summarization_model=' "$TMP/fresh/puppy.cfg"; then
  echo "Fresh installation must not pin an unverified model alias" >&2
  exit 1
fi
echo 'PASS: bash installer preserves configuration, supports force, and copies hidden templates'
