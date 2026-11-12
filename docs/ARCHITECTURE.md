# Architecture — Omega on Code Puppy

How the Omega pattern maps onto Code Puppy, and how a run actually
works. Sources: public `mpfaffenberger/code_puppy` (HEAD) and
`ant3869/puppy_gui` v0.16.2, plus the Omega guide at
murphmaxxing.com/vault/omega-agent-orchestration.

## Omega → Code Puppy mapping

| Omega requirement | Code Puppy equivalent | Fit |
|---|---|---|
| Opus 5.5 orchestrator, xhigh effort | JSON agent `omega-orchestrator`, `"model": "<opus alias>"`, `model_settings.reasoning_effort: "high"` (no `xhigh` — closest is `high`) | Adapt |
| Haiku 5.5 workers in `.claude/agents/` | JSON agents in `.code_puppy/agents/` (`omega-builder/reviewer/tester/researcher`), each `"model": "<alias>"` | 1:1, new path |
| Brief ends with runnable "Done when:", boss re-runs check | Orchestrator system prompt + worker contract; boss has `shell` tool, workers report exact command + output | 1:1 (prompt-level) |
| Boss delegates code writes | No dedicated file-write tools; `shell` can still modify files, so this is an agent policy rather than a security boundary | Behavioral constraint |
| `CLAUDE.md` + `docs/*.md` memory | `.code_puppy/AGENTS.md` (or `./AGENTS.md`) holds the rules; `docs/progress.md`, `docs/decisions.md`, `docs/known-issues.md` are plain files the agent is instructed to read/write each session | Adapt (file rename) |
| Reflect skill | `skills/reflect/SKILL.md`, agentskills.io format, project-local | 1:1 |
| `CLAUDE_CODE_SUBAGENT_MODEL=haiku` env vars | Dead in Code Puppy — models are pinned in agent JSON / `/pin_model`, not env vars | Drop |
| Compact at 40% | `compaction_threshold` in `puppy.cfg` — but clamped to [0.5, 0.95], so 0.4 becomes 0.5. Closest achievable is 50% | Adapt (50%, not 40%) |
| `/effort ultracode` (16 parallel, dozens–hundreds/run) | No equivalent. Parallelism = multiple `invoke_agent` calls in one response; breadth unbounded by config | Partial — no fan-out cap, no built-in mode |

Verified mechanics behind this table:

- **Per-worker model pinning exists two ways.** JSON agents accept a
  `"model"` field, and `/pin_model <agent> <model>` pins a model to
  any agent. The runtime has `invoke_agent_with_model(agent_name,
  prompt, model_name)` — a tool the orchestrator calls to delegate
  with a one-call model override. Its docstring blesses the Omega
  pattern: invoke sub-agents concurrently in one batch rather than
  one at a time.
- **Project-local agents work.** `discover_json_agents()` loads
  `~/.code_puppy/agents/` and `<CWD>/.code_puppy/agents/`; project
  wins on collision. A repo ships worker definitions that auto-load
  when Code Puppy runs from that project dir. No install step for
  agents.
- **Skills use the agentskills.io SKILL.md spec**, discovered at
  `~/.code_puppy/skills/` and `./skills/`.
- **Hooks are Claude Code-compatible.** Code Puppy reads
  `.claude/settings.json` hooks (PreToolUse/PostToolUse, same
  exit-code contract) and custom slash commands from
  `.claude/commands/`.
- **Rules load from AGENTS.md** (global `~/.code_puppy/AGENTS.md`,
  then `.code_puppy/AGENTS.md`, then `./AGENTS.md`), with a
  per-file char cap. **Zero references to `CLAUDE.md` in the
  codebase — Code Puppy never reads it.**
- **Compaction is configurable**: `compaction_threshold` (fraction
  of context, default 0.85) and `summarization_model` (pin a cheap
  summarizer) both exist as `puppy.cfg` keys.
- **Model families are known**: `model_utils.py` tags `opus-5`,
  `haiku-5`, `sonnet-5`, `fable-5`; Claude Code auth registers
  `claude-code-*` models. Recursion depth default is 4
  (orchestrator → worker is depth 1, fine). No concurrency cap
  found — breadth is model-driven.
- **GUI needs no changes.** `puppy_gui` is a thin facade over the
  `code_puppy` package (FastAPI → service layer → runtime);
  delegation renders as nested cards. The harness is config +
  templates, not code.

## Run mechanism — how a run starts, and how it is driven

There is no daemon, cron, webhook, or background service in this
harness. **The catalyst for a run is always a human giving the
orchestrator a goal plus a runnable "Done when:" check.** Everything
else follows from that one message.

### The trigger

Two ways in, same destination:

1. **Direct:** open Code Puppy GUI (or CLI) in the project, start a
   new chat on the `omega-orchestrator` agent, and type the goal plus
   its check. Example: *"Add a `GET /health` endpoint returning 200
   with `{"status":"ok"}`. Done when: `pytest tests/test_health.py`
   passes."*
2. **One-line trigger (recommended):** type `/omega-brief` and fill in
   the goal. The command formats it into a proper brief (GOAL, FILES
   TO READ, runnable "Done when:") and tells you to send it to the
   orchestrator. It is a formatter, not an auto-dispatcher — you still
   press send, so nothing runs without you seeing the brief first.

Either way, the run starts the moment the orchestrator receives a goal
with a check. No goal, no run — the orchestrator does not poll for
work, watch files, or self-start.

### Fan-out

The orchestrator breaks the goal into briefs and dispatches them by
issuing **several `invoke_agent` / `invoke_agent_with_model` calls in
a single response**. Code Puppy runs those sub-agents in parallel; in
the GUI each one renders as a nested card under the orchestrator's
turn, with its own thinking, tool calls, and result. Start with 2–4
workers per run. There is no ultracode mode and no fan-out cap, so
breadth is your discipline, not a setting.

### Verify-and-send-back loop

1. A worker finishes its brief, runs its check, and reports the exact
   command plus its output. It never reports done until the check
   passes.
2. The orchestrator **re-runs the check itself** (`shell` +
   `read_file`) before accepting anything. Pass → it folds the result
   into its answer. Fail → it sends the work back to the same worker
   with the failure attached.
3. Same check failing twice → the orchestrator re-briefs the job **one
   tier up** (Haiku worker → Sonnet; Sonnet worker → the orchestrator
   verifies it line by line itself).

This loop is the whole quality story. Cheap workers are safe here
because nothing they produce is trusted until the orchestrator has
run the check with its own hands.

### Session rituals (from AGENTS.md)

- **Session start:** the orchestrator reads `AGENTS.md`,
  `docs/progress.md`, `docs/decisions.md`, `docs/known-issues.md`
  before doing anything else.
- **Session end:** `omega-researcher` proposes a dated progress entry
  and any new decisions/gotchas. `omega-builder` writes approved entries;
  the orchestrator verifies the files, then invokes `reflect` using
  `activate_skill`. Reflect proposals require human approval.

### Day to day

Open GUI in the project → new chat on `omega-orchestrator` (or
`/omega-brief` with a goal) → watch worker cards in the run feed →
answer if the orchestrator asks a question → review the final summary
→ let the session-end ritual run. The next session starts from the
docs, so the system remembers what the last one learned.

### Delegation flow (text diagram)

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

## Tool allowlists (not a sandbox: shell can mutate files)

| Agent | Tools |
|---|---|
| orchestrator | `invoke_agent`, `invoke_agent_with_model`, `list_agents`, `read_file`, `grep`, `shell`, `activate_skill` |
| builder | `create_file`, `replace_in_file`, `read_file`, `grep`, `shell` |
| reviewer | `read_file`, `grep`, `shell` |
| tester | `shell`, `read_file`, `grep` |
| researcher | `read_file`, `grep`, `shell` (read-only commands only) |

The orchestrator omits dedicated write tools, but `shell` is capable of
writing; the no-edit rule depends on compliance. For session-end docs,
`omega-researcher` drafts a proposed change, `omega-builder` applies
approved entries, and the orchestrator verifies them with `read_file`.

## Integration notes (from ant3869/ai-integration-reference)

Ant's own backend-integration reference
(`ant3869/ai-integration-reference`, read Nov 12) shapes how this
harness talks to Code Puppy:

- **No stable programmatic API on the raw CLI.** Its
  `harnesses/code-puppy.md` warns: "Do not assume a stable HTTP API,
  JSON-RPC server, or SDK with Codex-equivalent event types" and to
  treat raw CLI integration as "interactive-only / experimental
  subprocess integration". Its best extension surface is MCP +
  custom agents. That is why this harness is config + templates (not
  a subprocess driver), and why the Electron shell talks to
  `puppy_gui`'s HTTP API instead of driving `code-puppy` directly —
  see `docs/FRONTEND.md`.
- **Run/delegation-record framing.** Its
  `architecture/session-and-events.md` defines the shape the Electron
  shell's run store uses: stable app-generated run IDs, one
  delegation record per worker (parent run, child agent, objective,
  status, result summary), terminal statuses
  (`completed | incomplete | failed | canceled | unknown`), and the
  rule that admission is never completion — a worker counts as done
  only when its check passes. Crash recovery (reconcile before retry,
  never auto re-execute a pending tool call, never resurrect a denied
  approval) is the same doc's algorithm and applies to the shell's
  `runs.json` store.
- **AGENT.md vs AGENTS.md.** The reference says a project-specific
  `AGENT.md` may define local instructions; the source-verified
  loading in Code Puppy is `AGENTS.md` (above). The harness ships
  `AGENTS.md`; if the internal Walmart build honors `AGENT.md`
  instead, rename it there.

## Gotchas baked into the templates

- **`AGENTS.md` is not injected into subagents** (verified in
  `subagent_invocation.py`). Every brief must be self-contained —
  which is exactly the Omega discipline, but it fails silently if you
  assume workers see project rules.
- **Compaction floors at 0.5.** "Compact at 40%" is unachievable as
  written; the harness uses 0.5 and says so everywhere.
- **SessionStart/SessionEnd hooks are unconfirmed** in Code Puppy.
  The session rituals are therefore implemented as instructions in
  `AGENTS.md` + the reflect skill, not as hooks.
  `templates/.claude/settings.json` ships with empty hook arrays as a
  placeholder — fill it in only after verifying hook support on your
  build.
- **The `omega` metadata block** in each agent JSON (tier, alternate
  model, flip rules) is harness documentation. If your build rejects
  unknown keys, delete the block — `"model"` is the only
  load-bearing field.
- **No fan-out or cost guardrail.** Omega's own page admits
  multi-agent runs use ~15× the tokens of a chat; Code Puppy has no
  ultracode equivalent, no parallel cap, and each subagent's result
  lands back in the orchestrator's context. Start with 2–4 workers.
