#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
repo="$PWD"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/project"
printf 'existing rules\n' > "$tmp/project/AGENTS.md"
printf 'keep-project-cfg\n' > "$tmp/project/puppy.cfg"

"$repo/install.sh" "$tmp/project"
grep -Fxq 'existing rules' "$tmp/project/AGENTS.md"
grep -Fxq 'keep-project-cfg' "$tmp/project/puppy.cfg"
test -f "$tmp/project/.code_puppy/agents/omega-orchestrator-agent.json"
test -f "$tmp/project/skills/reflect/SKILL.md"
test -f "$tmp/project/docs/progress.md"

"$repo/install.sh" "$tmp/project" --force
cmp "$repo/templates/AGENTS.md" "$tmp/project/AGENTS.md"
grep -Fxq 'keep-project-cfg' "$tmp/project/puppy.cfg"

mkdir -p "$tmp/clean"
"$repo/install.sh" "$tmp/clean"
test ! -e "$tmp/clean/puppy.cfg"

# Core-isolation negative tests use a fake home and untouched sentinel files.
mkdir -p "$tmp/home/.code_puppy/agents" "$tmp/home/.code-puppy-venv" "$tmp/symlink-project"
printf 'global-agent-untouched\n' > "$tmp/home/.code_puppy/agents/omega-builder-agent.json"
printf 'global-venv-untouched\n' > "$tmp/home/.code-puppy-venv/sentinel"
if HOME="$tmp/home" "$repo/install.sh" "$tmp/home" --force > "$tmp/blocked.log" 2>&1; then
  echo "Installer incorrectly allowed HOME as a project" >&2
  exit 1
fi
if HOME="$tmp/home" "$repo/install.sh" "$tmp/home/.code_puppy" --force > "$tmp/blocked.log" 2>&1; then
  echo "Installer incorrectly allowed global Code Puppy directory" >&2
  exit 1
fi
ln -s "$tmp/home/.code_puppy" "$tmp/symlink-project/.code_puppy"
if HOME="$tmp/home" "$repo/install.sh" "$tmp/symlink-project" --force > "$tmp/blocked.log" 2>&1; then
  echo "Installer incorrectly followed a symlink into global agents" >&2
  exit 1
fi
test ! -f "$tmp/symlink-project/AGENTS.md"
grep -Fxq 'global-agent-untouched' "$tmp/home/.code_puppy/agents/omega-builder-agent.json"
grep -Fxq 'global-venv-untouched' "$tmp/home/.code-puppy-venv/sentinel"

python3 - <<'PY'
import json
from pathlib import Path
root = Path('templates/.code_puppy/agents')
files = sorted(root.glob('*.json'))
assert len(files) == 5
for path in files:
    agent = json.loads(path.read_text(encoding='utf-8'))
    assert all(k in agent for k in ('name', 'description', 'system_prompt', 'tools'))
    assert isinstance(agent['tools'], list)
    assert agent['model']
    assert 'ISOLATION:' in agent['system_prompt'], path.name
    assert 'Never modify or install into Code Puppy core' in agent['system_prompt']
researcher = json.loads((root / 'omega-researcher-agent.json').read_text())
assert not {'create_file', 'replace_in_file', 'delete_file'} & set(researcher['tools'])
builder = json.loads((root / 'omega-builder-agent.json').read_text())
assert {'create_file', 'replace_in_file'} <= set(builder['tools'])
print('Agent JSON + installer smoke checks passed')
PY
