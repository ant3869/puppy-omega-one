---
description: Format a goal into an Omega brief and hand it to the omega-orchestrator. The one-line trigger for kicking off a job.
---

Write an Omega brief for the goal below, then present it ready to send
to the `omega-orchestrator` agent. Do not start the work yourself — the
brief is the handoff.

Goal: $ARGUMENTS

Format the brief exactly like this:

```
GOAL: <one sentence, what done looks like>
FILES TO READ: <the files the worker must read, or "ask the orchestrator" if unknown>
DONE WHEN: <one runnable check — a test command, a file that must exist, a number on screen>
```

Rules for the brief:
- One goal only. If $ARGUMENTS contains several goals, split them and
  produce one brief per goal, numbered.
- The "Done when:" check must be runnable or visible. If the goal has
  no obvious check, say so and propose the closest one instead of
  inventing a weak one.
- Keep it short. A brief that would push a Haiku worker past ~100k
  prompt tokens gets flagged (that worker flips to Sonnet).

Then tell me: "Send this to omega-orchestrator to start the run."
