# Reference — historical Omega research

This folder holds the original research the harness was built from.

## Sources

- The Omega setup itself: [murphmaxxing.com/vault/omega-agent-orchestration](https://murphmaxxing.com/vault/omega-agent-orchestration) — public guide by Aidan Murphy (@murphmaxxing)
- The Instagram reel it came from: [instagram.com/reel/Dff39V1vpj7](https://www.instagram.com/reel/Dff39V1vpj7/) — reposted by Bryce Breedlove

## Files

- `omega-setup-recreation.html` — recreation of the reel's guide built Nov 11, 2026 from Ant's screenshots: the loop diagram, model pricing, and starter files. Open it in a browser to read it.
- `omega-code-puppy-feasibility.md` — the Nov 12 research write-up mapping Omega onto Code Puppy: what translates 1:1, what doesn't (Code Puppy never reads `CLAUDE.md`, the reel's env vars are dead there, compaction clamps at 50%), the model-tier analysis, and the repo outline this scaffold was built from.

> Historical note: the reference documents record the original research and
> may describe the old installer behavior. Follow the root README and
> `docs/ARCHITECTURE.md` for current installation instructions.


## Read before reusing these notes

**Archived research, not a current setup or security guide.** The
original references predate the merged Electron features and include
model IDs, prices, terminal behavior and installer outlines that have
**not been reverified** against an installed runtime or current provider.

For current instructions use [root README](../README.md), the
[implementation matrix](../docs/STATUS.md), [models](../docs/MODELS.md),
[costs](../docs/COSTS.md), and [QA checklist](../docs/LOCAL_QA.md).
Current installers **do not** modify global `puppy.cfg`, and native
chat-send remains disabled pending real-session verification.
