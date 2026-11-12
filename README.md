<img src="assets/logo.png" alt="Puppy Omega One logo — the powered-up Border Collie, glowing cyan eyes, cyan and violet energy aura crackling off his body, the Omega formed by his energy" width="320">

# Puppy Omega One

An orchestrator-and-workers setup for Code Puppy, adapted from the
"Omega" Claude Code pattern (Opus plans, Haiku does the work) to the way
Code Puppy actually works. **Config + templates at the core** (plus an
optional Electron shell starter in `electron/`). No backend of its own,
no service, nothing phones home. You copy the templates into a project,
Code Puppy picks them up, and the orchestrator runs the loop.

> **⚠️ PLACEHOLDER MODELS — READ FIRST**
>
> Every model alias in this repo is a **placeholder**: `claude-opus-5-5`,
> `claude-sonnet-5-5`, `claude-haiku-5-5`. They match the public API IDs,
> but the target Code Puppy environment may expose different alias strings.
> Before your first real run: open your Code Puppy installation, type `/model`,
> note the real Opus / Sonnet / Haiku alias strings, and swap them into
> `.code_puppy/agents/*.json` (one `"model"` string per file) and
> `puppy.cfg`. Nothing here is load-bearing until those match your build.
> See `docs/MODELS.md` for the full story.

## What it is

| Piece | What it does |
|---|---|
| `omega-orchestrator` (Opus) | Plans the job, writes a brief per worker, checks every result. Is instructed not to write code and has no direct editing tools; its `shell` access is not read-only. |
| `omega-builder` (Sonnet) | Writes code to a brief, runs the check, reports what it ran. |
| `omega-reviewer` (Sonnet) | Reads a diff against a brief, lists what fails it. Fixes nothing. |
| `omega-tester` (Haiku) | Runs tests, triages the output, says PASS/FAIL first. |
| `omega-researcher` (Haiku) | Searches the codebase, summarizes with file + line cites. No shell or editing tools. |
| `skills/reflect` | End-of-session review: proposes the smallest skill/`AGENTS.md` edit that would have prevented what went wrong. You approve before anything changes. |

Model tiers are performance-first (work pays the bill, correctness wins):
Sonnet does the writing and reviewing because it scores 70.6% vs Haiku's
39.2% on agentic coding (Terminal-Bench 4.0, Anthropic's own numbers).
Haiku does the checkable, read-only work — testing, research, summaries —
where a mistake is cheap to spot. Full reasoning in `docs/MODELS.md`,
cost math in `docs/COSTS.md`.

## Install

```powershell
# Windows (PowerShell) — from this repo, into your project:
.\install.ps1 -Target C:\path\to\your-project

# macOS / Linux:
./install.sh /path/to/your-project
```

What it does: copies `templates/` into the target project (skips files
that already exist unless you pass `-Force` / `--force`). **It does not
modify Code Puppy's global configuration.** The runtime reads
`~/.code_puppy/puppy.cfg` (or `$XDG_CONFIG_HOME/code_puppy/puppy.cfg`),
not a file in your project. See `docs/ARCHITECTURE.md`. It prints the manual
steps at the end — read them, two of them need you.

Manual steps after install (the script prints these too):

1. **Verify the model aliases.** In your Code Puppy installation, run `/model`.
   Swap the real Opus / Sonnet / Haiku alias strings into
   `.code_puppy/agents/*.json` (`"model"` field). Delete the `omega` metadata block in an
   agent JSON if your build rejects unknown keys — `model` is the only
   load-bearing field.
2. **Optionally change global compaction settings** in Code Puppy, after
   checking your existing settings: `/set compaction_threshold 0.5` and
   `/set summarization_model <your verified Haiku alias>`. These apply
   to your user account, not just the installed project.
3. **Select `omega-orchestrator`** as the agent and confirm its model
   is the expected Opus alias.
4. **Network access:** connect to any network required by your model provider.

## Work-computer handoff

Clone the **public harness only** to your work computer, then install
its templates into the actual project you want Code Puppy to work on:

```powershell
git clone https://github.com/ant3869/puppy-omega-one.git
cd puppy-omega-one
.\install.ps1 -Target C:\path\to\your-work-project
```

Open Code Puppy **from your target project's directory** so it finds
the project-local agents. Confirm the model aliases on that computer,
since they may differ from the public Code Puppy build. Keep internal
source code, tokens, and private configuration out of this public
harness repository.

To validate the public scaffold itself, see
`tests/smoke_install.sh` and the GitHub Actions checks. The Electron
shell is optional and requires a separate `puppy_gui` installation.

## Run a job — the concrete walkthrough

The trigger for a run is always **you, giving the orchestrator a goal
plus a runnable "Done when:" check**. There is no daemon, cron, or
webhook. Day to day it looks like this:

1. `cd` into your project and open **Code Puppy GUI** (or the CLI).
   The project-local agents in `.code_puppy/agents/` load automatically.
2. Start a **new chat on the `omega-orchestrator` agent** (Agents view →
   `omega-orchestrator`, or switch agents in chat). Check the model shown
   is your Opus alias.
3. Give it the goal. Either type it freeform, or use the one-line trigger:
   type `/omega-brief` and fill in the goal — it formats a proper brief
   (GOAL, FILES TO READ, runnable "Done when:" check) for you to send.
   Example goal: *"Add a `GET /health` endpoint that returns 200 with
   `{"status":"ok"}`. Done when: `pytest tests/test_health.py` passes."*
4. The orchestrator reads `AGENTS.md` + `docs/progress.md`,
   `docs/decisions.md`, `docs/known-issues.md` (session-start ritual),
   then writes one brief per worker and **fans out**: it issues several
   `invoke_agent` / `invoke_agent_with_model` calls in a single response,
   so the workers run in parallel. In the GUI they show as nested cards
   under the orchestrator's turn.
5. Each worker does its brief, runs its check, and reports the exact
   command it ran plus the output. A worker never reports done until its
   check passes.
6. The orchestrator **re-runs every check itself** (it has `shell` +
   `read_file`) before accepting anything. Pass → it folds the result
   into its answer. Fail → it sends the work back to the same worker
   with the failure attached. Same check failing twice → it re-briefs
   the job one tier up (Haiku worker → Sonnet; Sonnet worker → the
   orchestrator verifies it line by line).
7. When the goal is done, the orchestrator tells you what changed, what
   it ran, and what is still open. You review and approve.
8. **Session-end ritual** (every session, don't skip it): the
   orchestrator asks `omega-researcher` for a read-only session summary,
   briefs `omega-builder` to record dated updates in the project docs,
   and runs the `reflect` skill. Changes to skills or `AGENTS.md` are
   proposed for your approval, not applied automatically.

Two rules that make the whole thing work: briefs are **self-contained**
(workers never see `AGENTS.md` — Code Puppy doesn't inject it into
subagents, so everything a worker needs goes in the brief), and every
brief ends with a **runnable check**. No check, no brief.

## The loop (text diagram)

```
you ── goal + "Done when:" ──▶ omega-orchestrator (Opus, high effort)
                                      │
              ┌───────────┬───────────┼───────────┬───────────┐
              ▼           ▼           ▼           ▼           ▼
        omega-builder omega-reviewer omega-tester omega-researcher
        (Sonnet)      (Sonnet)      (Haiku)     (Haiku)
              │           │           │           │
              └───────────┴───────────┴───────────┘
                                      │  report: command + output
                                      ▼
                          orchestrator RE-RUNS the check
                          pass → accept    fail → send back
                          (2nd fail → re-brief one tier up)
                                      │
                                      ▼
                        session end: docs update + reflect skill
```

## Model tiers

| Agent | Default | Alternate | Flip up when |
|---|---|---|---|
| orchestrator | Opus 5.5 (`claude-opus-5-5`) | Sonnet 5.5 | N/A — if Opus is unavailable, Sonnet runs the chair |
| builder | Sonnet 5.5 (`claude-sonnet-5-5`) | Haiku 5.5 — small, well-specified, single-file edits | Brief is vague, multi-file, or a refactor → orchestrator verifies line by line |
| reviewer | Sonnet 5.5 (`claude-sonnet-5-5`) | Haiku 5.5 — lint-level first pass only | Review needs judgment (security, architecture) → stays Sonnet |
| tester | Haiku 5.5 (`claude-haiku-5-5`) | Sonnet 5.5 | Can't diagnose a failure after one attempt |
| researcher | Haiku 5.5 (`claude-haiku-5-5`) | Sonnet 5.5 | Ambiguous, multi-hop, needs synthesis |
| compaction/summarizer | Haiku 5.5 (`claude-haiku-5-5`) | — | — |

Switching a worker's tier is one string: the `"model"` field in its
`.code_puppy/agents/omega-*.json`, or `/pin_model <agent> <model>` in
Code Puppy. Also flip any Haiku worker to Sonnet when its brief would
pass ~100k prompt tokens — past that line Haiku costs 5× more and its
quality drops fastest. Details in `docs/MODELS.md`.

## Costs (short version)

Opus $4/$20, Sonnet $2/$10, Haiku $0.10/$0.50 per million input/output
tokens; Haiku jumps to $0.50/$2.50 past 100k-token prompts. Multi-agent
runs use roughly 15× the tokens of a single chat (Omega's own number) —
the saving is per-token price, not token count. Work pays, so this
harness optimizes for correctness; the guardrails are still there
(short briefs, start with 2–4 workers, Haiku summarizer). Full math in
`docs/COSTS.md`.

## What's in the repo

```
puppy-omega-one/
├── README.md                  # this file
├── install.ps1 / install.sh   # copy templates into a project, set puppy.cfg
├── assets/
│   ├── logo.png               # logo art (powered-up puppy, branding)
│   └── icon.png               # minimal Omega mark (Electron app icon)
├── templates/
│   ├── AGENTS.md              # Omega rules, Code Puppy edition (the orchestrator reads this)
│   ├── .code_puppy/agents/    # omega-orchestrator/builder/reviewer/tester/researcher.json
│   ├── skills/reflect/SKILL.md
│   ├── docs/progress.md / decisions.md / known-issues.md   # seeded memory files
│   ├── .claude/settings.json  # hooks placeholder (session hooks TBD — see ARCHITECTURE.md)
│   └── .claude/commands/omega-brief.md, omega-review.md
├── docs/
│   ├── ARCHITECTURE.md        # Omega → Code Puppy mapping, run mechanism, delegation flow
│   ├── MODELS.md              # Sonnet vs Haiku research, tier table, placeholder aliases
│   ├── COSTS.md               # pricing, the 100k cliff, token math, guardrails
│   └── FRONTEND.md            # Electron shell: architecture, wired vs stub, sources
└── electron/                  # desktop shell starter (Electron, Mac + Windows) — see docs/FRONTEND.md
```

## What this is NOT

- Not a Claude Code setup. Code Puppy never reads `CLAUDE.md`,
  `.claude/agents/`, or the `CLAUDE_CODE_*` env vars — this harness
  translates Omega into Code Puppy's equivalents instead of pasting the
  reel's prompt verbatim. Full mapping in `docs/ARCHITECTURE.md`.
- Not a finished app. The `electron/` folder is a starter shell that
  wraps the existing puppy_gui server — see `docs/FRONTEND.md` for
  what's wired vs stub.
- Not verified against the target Code Puppy environment. The one gating
  unknown is which model aliases that build exposes. Check `/model`
  in the target environment first.
