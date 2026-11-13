# Project decisions (Omega template)

Use this file for decisions made **in the selected project**. The
statements below are default template constraints; do not assume an
unverified model, provider rate, or runtime capability is available.

## Seeded decisions

- **Project-scoped changes:** work only inside the selected project.
  Never patch Code Puppy core, global config, its Python environment or
  Puppy GUI source as part of an Omega task.
- **Verified model aliases first:** shipped Opus/Sonnet/Haiku alias
  values are examples. Run `/model` in the installed runtime and record
  actual working aliases before submitting a goal.
- **Runnability over claims:** worker reports and local draft records
  are not completion evidence. The orchestrator reruns the acceptance
  check before reporting a pass.
- **User controls global settings:** the Omega installer does not
  modify `puppy.cfg`, compaction or provider configuration.
- **No blind dispatch:** existing GUI chat is used for manual execution
  until session and project binding can be independently verified.

## Project-specific decisions

- (Add dated decisions after a real project session.)
