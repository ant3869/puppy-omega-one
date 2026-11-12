# Decisions

What's settled, with the date and why. The orchestrator reads this at
session start so it doesn't re-litigate settled questions.

## Decisions

- 2026-11-12 — Orchestrator runs on Opus, builder and reviewer on
  Sonnet, tester and researcher on Haiku. Reason: Sonnet scores 70.6%
  vs Haiku's 39.2% on agentic coding (Terminal-Bench 4.0); Haiku does
  the checkable, read-only work. See `docs/MODELS.md`. Cost is
  secondary (work pays); performance decides the tier.
- 2026-11-12 — Compaction at 50% (`compaction_threshold=0.5`), not
  Omega's 40%, because Code Puppy clamps the value to [0.5, 0.95].
- 2026-11-12 — Rules live in `AGENTS.md`, not `CLAUDE.md`. Code Puppy
  never reads `CLAUDE.md`; `.claude/agents/` and the
  `CLAUDE_CODE_*` env vars are dead in Code Puppy.
- 2026-11-12 — The orchestrator has no write tools. Session-end doc
  updates go through a brief to `omega-researcher`.
