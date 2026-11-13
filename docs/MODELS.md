# Model configuration and worker roles

> **Current status (2026-11-12):** Model aliases in this repository are
> **unverified examples**. The repository does **not** prove that an alias
> exists in your installed Code Puppy runtime or is a valid current
> public API model ID. Provider pricing, availability, benchmark scores
> and reasoning-effort options must be checked for your environment
> before use. See [STATUS.md](STATUS.md) and [COSTS.md](COSTS.md).

## Project-local model selection

Omega ships one orchestrator and four workers:

| Agent | Intended job | Model tier encoded in shipped template |
| --- | --- | --- |
| `omega-orchestrator` | Plan, delegate, review independently verified results | `claude-opus-5-5` |
| `omega-builder` | Implement scoped changes and checks | `claude-sonnet-5-5` |
| `omega-reviewer` | Review architecture, diffs and failures | `claude-sonnet-5-5` |
| `omega-tester` | Run and triage deterministic tests | `claude-haiku-5-5` |
| `omega-researcher` | Read-only information gathering and summaries | `claude-haiku-5-5` |

Those literal strings are **the shipped JSON values, not a verification
of the public provider catalog**. Model availability depends on your
runtime build, credentials, endpoint and account permissions.

### Verify before first use

1. Start your **installed** Code Puppy runtime in the intended project
   and use `/model` to inspect the models actually exposed.
2. Confirm each requested alias works with the selected provider.
   Do not assume similarly named models have identical identifiers.
3. Edit the **project-local**
   `.code_puppy/agents/omega-*-agent.json` files to use verified
   `model` strings, or use a supported runtime model-pinning command
   if your installed build offers one.
4. Confirm the actual selected agent and model in the GUI before
   submitting a real prompt. The desktop Run composer currently shows
   the **template aliases**, not queried live model bindings.
5. Verify the runtime supports the chosen reasoning-effort value.
   A desired setting may not be accepted by every provider or model.
6. If you cannot confirm an alias, treat the agent as **not configured**
   rather than relying on a nonexistent model ID.

The Omega installer deliberately leaves user-global `puppy.cfg` and
your existing provider credentials untouched. Do not edit Code Puppy
core or global configuration as a side effect of running Omega.

## Role-based reasoning

- Use a capable planning model for the orchestrator when a task needs
  decomposition, security judgment and independent verification.
- Choose a coding-capable model for the builder and reviewer when
  behavior is ambiguous or a missed bug would be costly.
- Cheaper/faster models can help with file search, concise summaries
  and deterministic test triage **when output is checked**.
- Increasing the number of agents is not evidence of better quality.
  Keep briefs self-contained and include runnable `Done when:` checks.
- Worker response **does not** mean the proposed changes were accepted,
  tested or merged; only the real check and review establishes that.

These are orchestration choices, **not measured benchmark rankings in
your installed Code Puppy environment**.

## The earlier November 2026 model research

The original Omega feasibility study used illustrative
Opus/Sonnet/Haiku tiers and third-party/vendor-reported benchmark and
rate tables. They have **not been revalidated in this documentation
audit**, so they should not control new provider purchases or
configuration decisions. The original context is archived in
[reference/omega-code-puppy-feasibility.md](../reference/omega-code-puppy-feasibility.md).

For actual costs, check a current official provider document or your
account-specific rate schedule. See [COSTS.md](COSTS.md).

## Runtime contract status

No native GUI chat-session send contract has been verified yet.
Omega's Electron `puppy:sendPrompt` IPC intentionally throws, and
Live Monitor events do not independently verify which model/session
produced a turn. See [FRONTEND.md](FRONTEND.md) and the
[safe local QA steps](LOCAL_QA.md).
