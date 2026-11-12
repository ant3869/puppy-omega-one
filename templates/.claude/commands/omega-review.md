---
description: Send the latest diff to the omega-reviewer for a verdict against its brief. Read-only review, no fixes.
---

Send the current diff to the `omega-reviewer` agent for review.

What to review: $ARGUMENTS (a diff, a file list, or a brief name — if
empty, use `git diff` against the current branch).

Instructions for the review:
- The reviewer reads the diff against the brief's "Done when:"
  requirements and lists what fails it (file, line, what's wrong, what
  the brief required). It fixes nothing.
- Verdict first (PASS or FAIL + what fails), evidence after.
- If there is no brief for this diff, say so — a review without a
  brief is guesswork, and the reviewer should refuse rather than invent
  requirements.
