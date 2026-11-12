# Models — Sonnet vs Haiku for the workers

Plain-language write-up of the research behind the harness's model
tiers. Researched Nov 12, 2026. All benchmark numbers are Anthropic's
own, from the Sonnet 5.5 and Haiku 5.5 launch announcements — treat
them as vendor-reported, not independently verified.

## The three models at a glance

| | Haiku 5.5 | Sonnet 5.5 | Opus 5.5 |
|---|---|---|---|
| Released | Oct 7, 2026 | Sep 28, 2026 | Sep 2026 |
| Price, input / output per MTok | $0.10 / $0.50 (≤100k-token prompts) | $2 / $10 | $4 / $20 |
| Price past 100k-token prompts | $0.50 / $2.50 (whole request) | $2 / $10 (unchanged) | $4 / $20 (unchanged) |
| Speed (Artificial Analysis, max effort) | ~258 tok/s | ~155 tok/s | — |
| API default effort | medium | high | medium |
| Anthropic's one-liner | Fastest; high-volume, latency-sensitive work | Best combination of speed and intelligence | Starting point for most serious work |

## The benchmark gap that decides the tiers

| Benchmark | Haiku 5.5 | Sonnet 5.5 | Opus 5.5 |
|---|---|---|---|
| Terminal-Bench 4.0 (agentic coding) | 39.2% | **70.6%** | 66.4% (xhigh) |
| FrontierCode 1.1 (main) | 46.4% | 52.1% (xhigh) | — |
| OSWorld 2.1 (computer use) | 72.4% | 83.9% | 81.8% |
| Humanity's Last Exam (no tools) | 45.9% | 56.9% | — |
| Humanity's Last Exam (with tools) | 57.4% | 64.5% | **67.7%** |
| Chartography (no tools) | 46.4% | 61.6% | — |
| GDPval-AA v2.1 (office work) | 1620 | 1840 | **1846** |

Two things jump out:

1. **Sonnet beats Haiku by 31 points on agentic coding** (70.6% vs
   39.2% on Terminal-Bench 4.0). That is the single number that
   decides who writes code in this harness. Haiku is a real step up
   from Haiku 4.5 (which scored 0.0% on the same test), but it is
   still not a coding model for open-ended work. Anthropic says it
   directly: Sonnet and Opus "remain better choices for complex
   agentic coding."
2. **Sonnet also beats Opus on agentic coding** (70.6% vs 66.4%),
   while Opus leads on judgment-heavy tests (Humanity's Last Exam
   with tools, 67.7% vs 64.5%). So the orchestrator stays on Opus —
   its job is planning, judgment, and synthesis, not terminal coding
   — and the code-writing stays on Sonnet.

Independent hands-on testing agrees with the direction: in one
four-job Claude Code comparison, Haiku at max effort reached passing
tests first on well-specified jobs (median time-to-green 7:19 vs
Sonnet's 15:23), while Sonnet scored highest on the hard bug hunt
and kept working long after tests passed. Translation: Haiku is fast
to green on simple, well-specified work; Sonnet is better when the
work is hard or ambiguous.

## What Anthropic itself says

From Addy Osmani's (Anthropic, Claude Code team) guide "Which Claude
model should you build with?" (claude.dev, Nov 2026):

- **Start most work on Opus 5.5** at medium effort. Fable 5.2 is
  kept for the hardest jobs.
- **Sonnet 5.5** is for well-scoped work — a bug fix, a feature built
  against a spec. Medium effort, high for harder tasks.
- **Haiku 5.5** is for classification, routing, and extraction at
  volume, and for **subagents doing a bigger model's side tasks**.
- For subagents: "give small models only work where a mistake is
  cheap and easy to spot, like finding files, running tests and
  reading logs; keep code edits and judgment calls on the main model."
- The cost guide says it plainly: "For simple subagent tasks,
  specify `model: haiku`" — and "reserve Opus for complex
  architectural decisions or multi-step reasoning."

The role-by-role consensus from independent write-ups matches: keep
the orchestrator on Opus, put subagents that write or review code on
Sonnet, send read-only work (search, triage, summarizing) to Haiku.

## The tiering in this harness

| Agent | Default | Alternate | Flip up when |
|---|---|---|---|
| orchestrator | Opus 5.5 | Sonnet 5.5 (if Opus unavailable) | — |
| builder | Sonnet 5.5 | Haiku 5.5 — small, well-specified, single-file edits | Brief is vague, multi-file, or a refactor |
| reviewer | Sonnet 5.5 | Haiku 5.5 — lint-level first pass only | Review needs judgment (security, architecture) |
| tester | Haiku 5.5 | Sonnet 5.5 | Can't diagnose a failure after one attempt |
| researcher | Haiku 5.5 | Sonnet 5.5 | Ambiguous, multi-hop, needs synthesis |
| compaction / summarizer | Haiku 5.5 | — | — |

**Why the builder is Sonnet, not Haiku.** Ant said performance
matters more than cost, and the gap is 31 benchmark points on the
exact skill the builder needs. Haiku's speed advantage (about 1.7×
the output tokens per second) is real, but speed to a wrong answer
isn't performance. Haiku stays in the mix as the fast lane for tiny,
well-specified edits — and the Beckon test shows it genuinely wins
there, reaching green first. The orchestrator decides per brief.

**Why the reviewer is Sonnet.** Review is a judgment call: a missed
bug costs more than the model saves. Haiku is fine as a lint-level
first pass (style, obvious typos), never as the final verdict.

**Why tester and researcher are Haiku.** Both produce checkable
output: tests pass or fail, search results cite file + line. A
mistake is cheap to spot and the orchestrator re-runs the check
anyway. When the tester can't diagnose a failure, or the research
question turns ambiguous, the job flips up to Sonnet — that's the
safety valve, and it's written into both agents.

**The 100k flip rule.** Haiku's price jumps 5× once a prompt passes
100,000 tokens — and the higher tier applies to the *entire*
request, including cache reads and writes. Past that line Haiku is
only 4× cheaper than Sonnet instead of 20×, and long prompts are
exactly where Haiku's quality drops most. So: any Haiku worker
whose brief would pass ~100k prompt tokens flips to Sonnet. Keep
briefs short and this rarely triggers.

## PLACEHOLDER aliases — verify before you run

Every agent JSON in this repo pins a placeholder alias:

| Role | Placeholder alias |
|---|---|
| Opus 5.5 | `claude-opus-5-5` |
| Sonnet 5.5 | `claude-sonnet-5-5` |
| Haiku 5.5 | `claude-haiku-5-5` |

These match the public Anthropic API model IDs, and Ant believes the
work build uses the same shape — but the internal Walmart build may
expose different alias strings, and that is unverified. **Check
`/model` in Code Puppy at work** (tab completion lists what's
available), note the real strings, and swap them into the `"model"`
field of each `.code_puppy/agents/omega-*.json` and into `puppy.cfg`
(`summarization_model`). One string per file; or use `/pin_model
<agent> <model>` in Code Puppy to override without editing files.

## Sources

- Respan — "Claude Haiku vs Sonnet (5.5): Is 20x Cheaper Good
  Enough?" — https://www.respan.ai/blog/claude-3-5-sonnet-vs-claude-3-5-haiku
- Beckon — "Haiku 5.5 vs Sonnet 5.5 vs Fable 5.1 in Claude Code: 4
  Coding Tests" — https://www.heybeckon.ai/blog/haiku-sonnet-fable-claude-code-coding-tests/
- Aireiter — "Claude Haiku 5.5 vs Sonnet 5.5 API Compared (2026)" —
  https://aireiter.com/blog/claude-haiku-5-5-vs-sonnet-5-5-api
- Developers Digest — "Opus 5.5 vs Sonnet 5.5 vs Haiku 5.5" —
  https://www.developersdigest.tech/blog/claude-opus-5-5-vs-sonnet-5-5-vs-haiku-5-5
- Michael Leung — "Claude Models Compared" —
  https://www.michaelleung.info/latest-news/claude-models-compared-haiku-sonnet-opus-fable-2026
- Aoba Works — "Claude Code Subagents Model Selection: Role-by-Role
  Table" — https://en.aobaworks.com/claude-code-subagents-model-selection-role-by-role-table/
- Start Debugging — "Claude Haiku 5.5 vs Sonnet 5.5 vs Opus 5.5 for
  Coding-Agent Subagents" — https://startdebugging.net/2026/10/claude-haiku-5-5-vs-sonnet-5-5-vs-opus-5-5-for-coding-agent-subagents/
- Sulat — "Which Claude model to use? Anthropic says start on Opus
  5.5" — https://news.sulat.com/2026/11/10/which-claude-model-guide-opus-fable-sonnet-haiku-effort/
- Cosine — notes on Osmani's "Which Claude model should you build
  with?" — https://blog.cosine.ren/en/post/which-claude-model-to-build-with/
- Nexos — "Best Claude model for coding" —
  https://nexos.ai/blog/best-claude-model-for-coding/
- Omega guide — https://www.murphmaxxing.com/vault/omega-agent-orchestration
