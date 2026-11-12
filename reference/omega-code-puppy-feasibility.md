# Omega on Code Puppy — feasibility write-up

Researched Nov 12, 2026. Sources: public `mpfaffenberger/code_puppy` (HEAD) and Ant's `ant3869/puppy_gui` v0.16.2, plus the Omega guide at murphmaxxing.com/vault/omega-agent-orchestration.

## Verdict: feasible with adaptations

The core pattern maps almost 1:1 onto Code Puppy's native machinery. Mostly a file-layout translation, not a stretch. One gating unknown: model availability on the target Code Puppy environment (can't verify from outside).

## What was verified in the source

- **Per-worker model pinning exists two ways.** JSON agents accept a `"model"` field, and `/pin_model <agent> <model>` pins a model to any agent. The runtime has `invoke_agent_with_model(agent_name, prompt, model_name)` — the orchestrator calls it to delegate with a one-call model override. Its docstring blesses the Omega pattern: invoke sub-agents concurrently in one batch rather than one at a time.
- **Project-local agents work.** `discover_json_agents()` loads `~/.code_puppy/agents/` and `<CWD>/.code_puppy/agents/`; project wins on collision. A repo can ship worker definitions that auto-load when Code Puppy runs from that project dir. No install step for agents.
- **Skills use the agentskills.io SKILL.md spec**, discovered at `~/.code_puppy/skills/` and `./skills/` — a `skills/reflect/SKILL.md` in the repo loads project-locally.
- **Hooks are Claude Code-compatible.** Code Puppy reads `.claude/settings.json` hooks (PreToolUse/PostToolUse, same exit-code contract) and custom slash commands from `.claude/commands/`.
- **Rules load from AGENTS.md** (global `~/.code_puppy/AGENTS.md`, then `.code_puppy/AGENTS.md`, then `./AGENTS.md`), with a per-file char cap. **Zero references to `CLAUDE.md` in the codebase — Code Puppy never reads it.**
- **Compaction is configurable**: `compaction_threshold` (fraction of context, default 0.85) and `summarization_model` (pin a cheap summarizer) both exist as `puppy.cfg` keys.
- **Model families are known**: `model_utils.py` tags `opus-5`, `haiku-5`, `sonnet-5`, `fable-5`; Claude Code auth registers `claude-code-*` models (e.g. `claude-code-claude-opus-4-7`). Recursion depth default is 4 (orchestrator → worker is depth 1, fine). No concurrency cap found — breadth is model-driven.
- **GUI needs no changes.** `puppy_gui` is a thin facade over the `code_puppy` package (FastAPI → service layer → runtime); delegation renders as nested cards. The harness is config + templates, not code.

## Omega → Code Puppy mapping

| Omega requirement | Code Puppy equivalent | Fit |
|---|---|---|
| Opus 5.5 orchestrator, xhigh effort | JSON agent `omega-orchestrator`, `"model": "<opus alias>"`, `model_settings.reasoning_effort: "high"` (no `xhigh` — closest is `high`) | Adapt |
| Haiku 5.5 workers in `.claude/agents/` | JSON agents in `.code_puppy/agents/` (`omega-builder/reviewer/tester/researcher`), each `"model": "<haiku alias>"` | 1:1, new path |
| Brief ends with runnable "Done when:", boss re-runs check | Orchestrator system prompt + worker contract; boss has `shell` tool, workers report exact command + output | 1:1 (prompt-level) |
| Boss writes no code | Enforce by tool allowlist: orchestrator JSON gets `invoke_agent`, `invoke_agent_with_model`, `list_agents`, `read_file`, `grep`, `shell` — no `create_file`/`replace_in_file` | Better than Omega (enforced, not just instructed) |
| `CLAUDE.md` + `docs/*.md` memory | `.code_puppy/AGENTS.md` (or `./AGENTS.md`) holds the rules; `docs/progress.md`, `docs/decisions.md`, `docs/known-issues.md` are plain files the agent is instructed to read/write each session | Adapt (file rename) |
| Reflect skill | `skills/reflect/SKILL.md`, agentskills.io format, project-local | 1:1 |
| `CLAUDE_CODE_SUBAGENT_MODEL=haiku` env vars | Dead in Code Puppy — models are pinned in agent JSON / `/pin_model`, not env vars | Drop |
| Compact at 40% | `compaction_threshold` in `puppy.cfg` — but clamped to [0.5, 0.95], so 0.4 becomes 0.5. Closest achievable is 50% | Adapt (50%, not 40%) |
| `/effort ultracode` (16 parallel, dozens–hundreds/run) | No equivalent. Parallelism = multiple `invoke_agent` calls in one response; breadth unbounded by config | Partial — no fan-out cap, no built-in mode |

## Repo outline (installer + templates, copy into any work project)

```
omega-harness/
├── README.md                 # what it is, install, run a job, the loop diagram
├── install.ps1 / install.sh  # copies templates into target project; sets puppy.cfg
│                             #   compaction_threshold=0.5, summarization_model=<haiku>;
│                             #   prints the manual steps (set global model, /pin_model, VPN)
├── templates/
│   ├── AGENTS.md             # adapted Omega rules: orchestrator role, brief format,
│   │                         # verify-before-accept, session start/end rituals
│   ├── .code_puppy/agents/
│   │   ├── omega-orchestrator-agent.json  # Opus pin, no write tools, reasoning high
│   │   ├── omega-builder-agent.json      # Haiku pin, full file + shell tools
│   │   ├── omega-reviewer-agent.json     # Haiku pin, read-only + shell
│   │   ├── omega-tester-agent.json       # Haiku pin, test-running tools
│   │   └── omega-researcher-agent.json   # Haiku pin, read-only
│   ├── skills/reflect/SKILL.md          # end-of-session review, smallest-edit proposal, waits for OK
│   ├── docs/progress.md / decisions.md / known-issues.md   # seeded templates
│   ├── .claude/settings.json            # hooks (tool guards; session hooks TBD — see risks)
│   └── .claude/commands/omega-brief.md, omega-review.md
└── docs/
    ├── ARCHITECTURE.md       # Omega→Code Puppy mapping table, delegation flow
    ├── MODELS.md             # how to find/pin the Opus + Haiku aliases in the target environment
    └── COSTS.md              # token math, usage readout, guardrails
```

## Top 3 risks / gotchas

1. **Model availability on the target Code Puppy environment is unverified and load-bearing.** The GUI docs say Code Puppy in the target environment is an target Code Puppy environment not on public PyPI (GUI verified against 0.1.37) and models need VPN. Everything verified here is from the public repo. If the target environment doesn't expose Opus 5.5 + Haiku 5.5 (via `/claude-code-auth` or the target environment proxy), or exposes them under different alias strings, every pin in the harness breaks. This is the single gating unknown.
2. **The copy-paste trap: `CLAUDE.md`, `.claude/agents/`, and the env vars are dead in Code Puppy.** Pasting murphmaxxing's prompt verbatim produces files Code Puppy never reads. The harness must translate, not transcribe — and the reel's prompt does not work as-is.
3. **No fan-out or cost guardrail.** Omega's own page admits multi-agent runs use ~15× the tokens of a chat; Code Puppy has no ultracode equivalent, no parallel cap, and each subagent's result lands back in the orchestrator's context. A 16-worker fan-out on Opus-priced verification is a fast way to burn quota. Mitigation: start with 2–4 workers, keep briefs short (Haiku jumps to $0.50/$2.50 per MTok past 100k-token prompts), and use `summarization_model` = Haiku for compaction. Also unconfirmed: whether Code Puppy supports SessionStart/SessionEnd hooks for the end-of-session ritual — implement it as an instructed ritual + reflect skill until verified, not as a hook.

Two smaller footguns worth baking into the templates: `AGENTS.md` is deliberately **not** injected into subagents (verified in `subagent_invocation.py`), so every brief must be self-contained — which is exactly the Omega discipline, but it fails silently if you assume workers see project rules. And `compaction_threshold` floors at 0.5, so "compact at 40%" is unachievable as written.

## Single biggest open question for Ant

On your target machine, in Code Puppy, what Claude model aliases are actually available — is there an Opus 5.5 and a Haiku 5.5, how do you authenticate to them (`/claude-code-auth` vs. the provider-specific models), and what are their exact alias strings? Everything in the harness (orchestrator pin, worker pins, summarization model, cost math) hangs on those two strings. A 30-second check — `/model` + tab completion in Code Puppy in the target environment — answers it.

---

## Model tiers (Nov 12)

**Verdict: Sonnet does the writing and reviewing; Haiku does the checkable work.** Ant's call is performance-first (work pays), so the harness tiers on capability, not price — and Sonnet 5.5 is much closer to Opus than to Haiku on agentic coding. Anthropic's own numbers (Haiku 5.5 announcement): Terminal-Bench 4.0 — Haiku 39.2% vs Sonnet 70.6% vs Opus 66.4% (xhigh); FrontierCode — Haiku 46.4% / Sonnet 52.1%; OSWorld — Haiku 72.4% / Sonnet 83.9%; HLE with tools — Haiku 57.4% / Sonnet 64.5% / Opus 67.7%. Sonnet beats Opus on Terminal-Bench, but the orchestrator stays Opus (planning/judgment; Opus leads HLE-with-tools and GDPval). Anthropic's guidance (Addy Osmani, claude.dev): start most work on Opus; Sonnet for well-scoped work; Haiku for classification/routing/extraction at volume and subagents doing a bigger model's side tasks — "give small models only work where a mistake is cheap and easy to spot."

| Agent | Default | Alternate | Flip up when |
|---|---|---|---|
| orchestrator | Opus 5.5 | Sonnet 5.5 | N/A — Sonnet runs the chair if Opus is unavailable |
| builder | **Sonnet 5.5** | Haiku 5.5 — small, well-specified, single-file edits | Vague brief, multi-file, refactor → orchestrator verifies line by line |
| reviewer | **Sonnet 5.5** | Haiku 5.5 — lint-level first pass only | Judgment needed (security, architecture) → stays Sonnet |
| tester | Haiku 5.5 | Sonnet 5.5 | Can't diagnose a failure after one attempt |
| researcher | Haiku 5.5 | Sonnet 5.5 | Ambiguous, multi-hop, needs synthesis |
| compaction/summarizer | Haiku 5.5 | — | — |

This supersedes the repo outline above, which pinned all four workers to Haiku. Switching a worker's tier is one string: the `"model"` field in its `.code_puppy/agents/omega-*.json`, or `/pin_model <agent> <model>`. Also flip any Haiku worker to Sonnet when its brief would pass ~100k prompt tokens — past that line Haiku costs 5× more ($0.50/$2.50 vs $0.10/$0.50 per MTok) and its quality drops fastest. Pricing: Opus $4/$20, Sonnet $2/$10, Haiku $0.10/$0.50 per MTok. Full reasoning in the scaffold's `docs/MODELS.md`, cost math in `docs/COSTS.md`.

**Placeholder aliases used everywhere in the scaffold:** `claude-opus-5-5`, `claude-sonnet-5-5`, `claude-haiku-5-5`. They match the public API IDs but are unverified against the target Code Puppy environment — verify with `/model` in Code Puppy in the target environment and swap in the real strings. The open question above now covers three aliases, not two: Opus, Sonnet, and Haiku.

**Electron track (Nov 12):** the scaffold also ships an `electron/` starter (Mac + Windows, dark mode) built on Ant's `electron-react-dark-starter`, driving Code Puppy through the `puppy_gui` FastAPI server — not a second backend. Backend wiring follows Ant's `ai-integration-reference` (Code Puppy has no stable programmatic API on the raw CLI; `puppy_gui`'s HTTP API is the stable surface). Details in the scaffold's `docs/FRONTEND.md`. Name: **Puppy Omega One** (ONE spelled out, never the numeral 1), repo slug `puppy-omega-one`, logo `assets/logo.png` (powered-up puppy), app icon `assets/icon.png`.
