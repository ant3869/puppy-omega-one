---
name: reflect
description: End-of-session review. Lists what went wrong or took too long and proposes the smallest edit to a skill or AGENTS.md that would have prevented it. Use at the end of every session, before the docs update is finalized. Nothing is applied without the human's OK.
---

# Reflect

Run this at the end of every session, after the work is done and before
you close out. It is the mechanism that makes the harness better over
time instead of repeating the same mistakes.

## When to use

- End of every session, as part of the session-end ritual in AGENTS.md.
- After any session where something went wrong, took too long, or a
  worker had to be re-briefed.

## Procedure

1. **List what went wrong or took too long.** Be specific and use
   evidence from this session: the brief that was ambiguous, the check
   that failed twice, the worker that needed a tier flip, the rule a
   worker didn't know because it wasn't in the brief.
2. **For each item, propose the smallest edit** to a skill file or to
   `AGENTS.md` that would have prevented it. One edit per problem, and
   as small as you can make it — a sentence in a brief template, a
   line in a worker's system prompt, a row in a table. Never propose a
   rewrite when a sentence will do.
3. **Show each proposed edit as a diff** (old text → new text, with the
   file path) and wait for the human's OK on each one. **Never apply
   an edit yourself.** The human approves, and only approved edits get
   applied — by a worker briefed to apply them, or by the human.
4. **If nothing went wrong**, say so in one line and stop. Do not
   invent improvements for a session that worked.

## Rules

- Evidence from this session only. No generic advice, no "best
  practices" that didn't come up.
- Smallest edit wins. If two edits would fix the same problem, propose
  the smaller one.
- A proposal the human rejects is dropped, not re-argued. Note it in
  `docs/decisions.md` if it matters for later.
- The reflect skill itself can be edited by this process, same as any
  other skill.
