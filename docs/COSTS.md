# Token cost planning and runaway-work guardrails

> **Current status (2026-11-12):** Omega does **not** verify provider prices,
> enforce a token/spend budget, or measure independent cost per worker.
> Older per-model figures in the original project research were snapshots,
> **not live verified rates**. Do not use them as a current billing quote.
> See [models](MODELS.md), [status](STATUS.md) and [changelog](../CHANGELOG.md).

## Cost formula

For a given provider/model (ignoring caching, reasoning tiers, taxes,
minimums and other provider-specific adjustments):

```text
estimated input cost  = input tokens  / 1,000,000 × price per million input
estimated output cost = output tokens / 1,000,000 × price per million output
estimated total       = sum of both across all agent calls
```

**Hypothetical math, not provider pricing:** If a model billed
`$2 / million input` and `$10 / million output`, a call with
100,000 input and 20,000 output tokens would cost
`0.1 × $2 + 0.02 × $10 = $0.40`. Real costs depend on the provider,
account agreement, caching and actual token attribution.

## Why agent teams can cost more

A single goal may lead to orchestration planning, several independent
worker contexts, summaries, retries and verification calls. Each call
can resend context. That can cost substantially more tokens than a
single monolithic chat; there is **no verified universal 15× factor**
for this repository.

The existing Omega worker briefs **recommend** sensible limits, but
Omega's current Electron shell has **no enforced fan-out cap or API spend
limiter**. The GUI cost view, when available, may use user-supplied rates
and is not a substitute for a provider bill.

## What to do before a real run

1. Confirm the exact model ID/alias with `/model` in the **installed**
   Code Puppy runtime. Treat `claude-opus-5-5`,
   `claude-sonnet-5-5` and `claude-haiku-5-5` in this repo as
   **unverified configuration examples**.
2. Check the official provider pricing page or your organization-specific
   contract **at execution time** for input, output, reasoning, cached
   tokens, context tiers and per-request surcharges.
3. Start with one or two narrowly scoped workers and a runnable
   acceptance check; expand only after verifying actual costs/results.
4. Keep source excerpts and worker briefs focused. Favor deterministic
   lint/test commands for checks where possible.
5. Review the provider's own usage/cost dashboard after a disposable
   test run; do not infer actual charges from worker names or the
   simulated animation.
6. Apply hard budget/concurrency restrictions **at the provider, gateway
   or OS level if your environment supports them**, not merely in
   agent system prompts.

## Global Code Puppy settings

Some researched Code Puppy revisions support user-global
`summarization_model` and `compaction_threshold` settings.
**Omega's project installer does not read or modify global
`puppy.cfg`.** Verify configuration support in your installed
runtime before changing anything. A model alias in a templated agent
file is not proof the model is available or billed at a specific rate.

## Historical context

The original November 2026 feasibility notes discussed a speculative
Opus/Sonnet/Haiku split, a possible 100k-token pricing threshold and
a claimed multi-agent 15× token multiplier. These were research
assumptions, **not tests against this repo's installed runtime or
verified account billing**. Retained for context in
[reference/omega-code-puppy-feasibility.md](../reference/omega-code-puppy-feasibility.md).
