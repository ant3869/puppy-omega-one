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
researcher = json.loads((root / 'omega-researcher-agent.json').read_text())
assert not {'create_file', 'replace_in_file', 'delete_file'} & set(researcher['tools'])
builder = json.loads((root / 'omega-builder-agent.json').read_text())
assert {'create_file', 'replace_in_file'} <= set(builder['tools'])
print('Agent JSON + installer smoke checks passed')
PY
