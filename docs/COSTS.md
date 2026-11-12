# Costs — pricing, the 100k cliff, and guardrails

Prices are Anthropic list rates as of Nov 2026, per million tokens.
Work pays the bill, so this harness optimizes for correctness — but
the guardrails still matter, because a runaway fan-out burns quota
fast even when someone else is paying.

## Price table

| Model | Input / MTok | Output / MTok | Notes |
|---|---|---|---|
| Opus 5.5 | $4 | $20 | Orchestrator only. Half the price of Fable; best judgment. |
| Sonnet 5.5 | $2 | $10 | Builder + reviewer. Exactly half of Opus on every line. |
| Haiku 5.5 | $0.10 / $0.50 | $0.50 / $2.50 | Tester, researcher, summarizer. Cheap tier is prompts ≤100k tokens. |

Relative prices: Haiku is 20× cheaper than Sonnet and 40× cheaper
than Opus — **until a prompt crosses 100,000 tokens**. Then Haiku
jumps 5× (to $0.50/$2.50) and is only 4× cheaper than Sonnet. The
higher tier applies to the *entire* request once the prompt passes
100k, including cache reads and writes.

## The 100k cliff, in plain language

Haiku is the cheapest model in the family by a wide margin, but only
for short prompts. Agent loops cross 100k tokens faster than most
teams expect — a long brief plus a big file plus conversation history
adds up. Past the cliff you are paying Sonnet-adjacent prices for
Haiku-quality output, which is the worst of both worlds. That is why
the harness has a hard rule: **any Haiku worker whose brief would
pass ~100k prompt tokens flips to Sonnet**. Keep briefs short and
this rarely triggers.

## Token math — why multi-agent costs more in total

Omega's own guide admits multi-agent runs use roughly **15× the
tokens of a single chat**. The saving is per-token price, not token
count: the bulk of the tokens flow through Haiku ($0.10) and Sonnet
($2) instead of Opus ($4), and the orchestrator's own thinking stays
a small share. A rough sense of scale:

- A job that would be ~1M tokens as a single Opus chat (~$4 input)
  becomes ~15M tokens spread across the team. If 12M of those are
  Haiku input ($1.20) and 2M are Sonnet input ($4), the total is in
  the same ballpark — but the work is parallel, checked, and usually
  better. The win is quality and speed, not a smaller bill.
- The expensive failure mode is a wide fan-out on Opus-priced
  verification: 16 workers × long briefs × Opus re-checking
  everything. Start with 2–4 workers.

## Guardrails (built into the harness)

1. **Start with 2–4 workers per run**, not 16. There is no fan-out
   cap in Code Puppy — breadth is your discipline.
2. **Keep briefs short.** Short briefs keep Haiku under the 100k
   cliff and keep worker outputs small enough for the orchestrator
   to actually verify.
3. **Optional summarization on Haiku.** After verifying your alias,
   use Code Puppy `/set summarization_model <your Haiku alias>` and
   `/set compaction_threshold 0.5` if desired. These are **global user**
   settings; the project installer deliberately leaves them untouched. Compaction is the
   cheapest token you'll ever buy.
4. **Tier flips are the safety valve, not a cost control.** A worker
   that fails twice gets re-briefed one tier up even though it costs
   more — a wrong answer that ships costs more than a Sonnet call.
5. **Watch the context gauge.** Type `/context` in Code Puppy during
   a session. If the orchestrator's window is filling up with worker
   output, compact or narrow the next fan-out.

## Reading usage

Code Puppy GUI has a Cost view (editable per-model rate table + live
estimate for the active session). The runtime supplies no pricing
itself — the rates there are user-provided estimates, so set them
from the table above after you confirm the work build's actual
rates. If the internal build bills differently (flat rate, quota,
or internal chargeback), the per-token math above doesn't apply and
the tiering still stands on performance alone.
