# AGENTS.md — Puppy Omega One (Code Puppy edition)

> **PLACEHOLDER MODELS:** the agent JSON files under
> `.code_puppy/agents/` pin placeholder aliases (`claude-opus-5-5`,
> `claude-sonnet-5-5`, `claude-haiku-5-5`). Run `/model` in Code Puppy
> in the target environment, note the real alias strings, and swap them in. Nothing here
> is load-bearing until those match your build.

## The system

One orchestrator (Opus) plans, briefs, and verifies. Workers do the work.
The orchestrator must not write code or files. Its direct editing tools
are omitted, but `shell` can still write; this is a behavioral rule,
not a hard sandbox. The researcher has no shell or editor tools. If the orchestrator needs a file changed, it briefs a worker.

| Agent | Model (placeholder) | Job |
|---|---|---|
| `omega-orchestrator` | Opus 5.5 (`claude-opus-5-5`), effort high | Plans, briefs, verifies. No write tools. |
| `omega-builder` | Sonnet 5.5 (`claude-sonnet-5-5`), effort medium | Writes code to a brief, runs the check. |
| `omega-reviewer` | Sonnet 5.5 (`claude-sonnet-5-5`), effort medium | Reads a diff against a brief, lists failures. Fixes nothing. |
| `omega-tester` | Haiku 5.5 (`claude-haiku-5-5`), effort medium | Runs tests, triages output, PASS/FAIL first. |
| `omega-researcher` | Haiku 5.5 (`claude-haiku-5-5`), effort medium | Searches codebase, summarizes with file + line cites. Read-only. |

Why Sonnet writes and reviews instead of Haiku: on Anthropic's own
numbers Sonnet scores 70.6% vs Haiku's 39.2% on agentic coding
(Terminal-Bench 4.0). Haiku does the checkable, read-only work where a
mistake is cheap to spot. Full reasoning in the Puppy Omega One repo's
`docs/MODELS.md` (it lives in the repo, not in installed projects —
only `templates/` gets copied in).

## Code Puppy core isolation

Omega is a **project-scoped template**, not a Code Puppy patcher.

- Only create and modify files in the user's selected project workspace.
- Never edit or install into Code Puppy's package/source, Python virtual environment,
  user-global `~/.code_puppy/` files, agent registrations, or the Puppy GUI source.
- Do not run model setup, `pip install`, package upgrades or configuration commands
  against the Code Puppy interpreter or user-global environment.
- This restriction applies equally to the orchestrator, every worker, shell
  commands and delegated actions. Include it **verbatim in every worker brief**
  because subagents do not automatically inherit project `AGENTS.md`.
- If work appears to require touching Code Puppy itself, stop and report that
  it is out of scope. Use a separate, explicitly reviewed project instead.

These are agent instructions, **not** an operating-system sandbox. Only use
the harness with projects you trust; agents allowed to use shell/tools can
modify files permitted by the current OS user.

## The loop

1. **Session start:** read this file, then `docs/progress.md`,
   `docs/decisions.md`, `docs/known-issues.md`.
2. **Brief:** for each piece of work, write a brief with GOAL, FILES TO
   READ, and a runnable **"Done when:"** check (a test command, a file
   that must exist, a number on screen). No check, no brief.
3. **Fan out:** issue several `invoke_agent` / `invoke_agent_with_model`
   calls in a single response so workers run in parallel. Start with
   2–4 workers, not 16.
4. **Worker reports:** each worker runs its check and reports the exact
   command it ran plus the output. A worker never reports done until its
   check passes.
5. **Verify before accept:** re-run every worker's check yourself
   (`shell` + `read_file`). Pass → accept and fold it in. Fail → send
   the work back to the same worker with the failure attached. Never
   pass on a worker's report unchecked.
6. **Two failures, tier up:** if the same check fails twice, re-brief
   the job one tier up (Haiku worker → Sonnet; Sonnet worker → you
   verify it line by line yourself).
7. **Session end:** ask `omega-researcher` to summarize progress and
   decisions **without editing files**. Brief `omega-builder` to record
   the dated updates in `docs/progress.md`, `docs/decisions.md`, and
   `docs/known-issues.md`. Activate `reflect` with `activate_skill` (`skills/reflect/SKILL.md`)
   to propose improvements. Do not apply changes to skills or this file
   without the human's explicit approval.

## Brief rules — read this twice

- **Briefs are self-contained.** Workers NEVER see this file: Code Puppy
  does not inject `AGENTS.md` into subagents. Everything a worker needs
  — goal, files, constraints, the check — goes in the brief itself.
  If you assume a worker knows a project rule, it will silently not
  know it.
- **Every brief ends with a runnable "Done when:" check.** If the check
  can't be run or seen, the brief isn't ready.
- **Keep briefs short.** A Haiku worker's prompt past ~100k tokens
  costs 5× more and its quality drops fastest — flip it to Sonnet
  instead (change the `"model"` string in its agent JSON, or
  `/pin_model <agent> <model>`).
- **One job per worker.** A worker does its brief and stops; it doesn't
  pick up extra work or re-plan the job.

## Model tiers and flip rules

| Agent | Default | Alternate | Flip up when |
|---|---|---|---|
| orchestrator | Opus | Sonnet (if Opus unavailable) | — |
| builder | Sonnet | Haiku — small, well-specified, single-file edits | Brief is vague, multi-file, or a refactor |
| reviewer | Sonnet | Haiku — lint-level first pass only | Review needs judgment (security, architecture) |
| tester | Haiku | Sonnet | Can't diagnose a failure after one attempt |
| researcher | Haiku | Sonnet | Ambiguous, multi-hop, needs synthesis |

## Memory files

- `docs/progress.md` — where we are: done, next, a dated log line per session.
- `docs/decisions.md` — what's settled, with the date and why.
- `docs/known-issues.md` — gotchas and their fixes.

Read them at session start, update them at session end. They are the
only memory that survives compaction.

## Compaction

Code Puppy reads its **user-level** `~/.code_puppy/puppy.cfg` (or the
XDG config equivalent), not a project-local file. The installer does not change global settings. This project does not
require any global compaction change; configure such settings outside
Omega only if you independently choose to. Type `/context` to inspect usage.

## What Code Puppy does NOT do (don't paste the reel's prompt verbatim)

- It never reads `CLAUDE.md` — rules live here, in `AGENTS.md`.
- `.claude/agents/` is ignored — workers live in `.code_puppy/agents/`.
- `CLAUDE_CODE_SUBAGENT_MODEL` and `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE`
  env vars do nothing — models are pinned in agent JSON,
  compaction in `puppy.cfg`.
- No `xhigh` effort (closest is `high`), no `ultracode` fan-out mode.
  Parallelism is multiple `invoke_agent` calls in one response.
