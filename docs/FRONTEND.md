# Front end — Puppy Omega One desktop shell

The Electron app is a **shell on top of Code Puppy, not a second
backend**. It wraps the GUI Ant already built (`puppy_gui`) and adds
Omega-native views (run trigger, live worker cards, briefs, progress)
around it. This is a **starter + wiring plan, not a finished app** —
the wired-vs-stub table below is the honest state.

## Architecture

```
Puppy Omega One (Electron, React + Tailwind)
  ├─ Run / Live / Briefs / Progress views (native React pages)
  └─ Puppy GUI view (<webview> → http://127.0.0.1:8765)
        │
        ▼  HTTP, verified /api/* endpoints (see below)
puppy_gui (FastAPI server, launch_gui.py, Code Puppy venv python)
  ├─ service layer → code_puppy runtime
  └─ ChatBridge (streams chat + sub-agent events)
        │
        ▼
code_puppy runtime → Omega agents (.code_puppy/agents/*.json)
```

The main process (`electron/src/main/main.ts`) starts in **attach-only mode**:
it observes an existing local Puppy GUI service but never implicitly launches
Code Puppy. An explicit **Connect / start** button attempts attach/launch and
stops only the child it spawned on quit. The renderer never talks to the server directly — it goes
through the preload bridge (`window.omega`), same pattern as the
starter (below).

### Why the shell goes through puppy_gui, not the Code Puppy CLI

`ant3869/ai-integration-reference` (`harnesses/code-puppy.md`) is
explicit: Code Puppy is CLI-first and has **no stable programmatic
RPC/session protocol** — "Do not assume a stable HTTP API, JSON-RPC
server, or SDK with Codex-equivalent event types", and raw CLI
integration should be treated as "interactive-only / experimental
subprocess integration". Its best extension surface is MCP + custom
agents. So the shell does not drive `code-puppy` as a subprocess and
does not parse its colorized stdout. It talks to `puppy_gui`'s HTTP
API instead — the stable surface Ant already built and maintains over
the same runtime. That is the whole backend decision, and it comes
from his own reference guide.

The run-record design follows the same repo's
`architecture/session-and-events.md`: a run has stable app-generated
IDs, each worker is a **delegation record** (parent run, child agent,
objective, status, check result), statuses are terminal
(`completed | incomplete | failed | canceled | unknown`), and
**admission is never treated as completion** — a worker only counts as
done when its check result is `pass`. Draft records persist to
`runs.json` in the app's userData dir, not renderer state (same doc:
keep a canonical store; never trust UI state).

One naming discrepancy to verify: the reference guide says a
project-specific `AGENT.md` may define local instructions, while the
source-verified loading in Code Puppy is `AGENTS.md` (see
`ARCHITECTURE.md`). The harness ships `AGENTS.md`; if the internal
target environment honors `AGENT.md` instead, rename it there.

## What it is built on

**`ant3869/electron-react-dark-starter`** (Sep 17) — the Electron
shell is a direct reuse of this starter, not a from-scratch build:

- electron-vite + React 18 + Tailwind 3.4 + TypeScript,
  `src/main` / `src/preload` / `src/renderer` layout,
  `electron.vite.config.ts`.
- Main process pattern: `BrowserWindow` 1280×800, dark background,
  `contextIsolation: true`, `nodeIntegration: false`, sandboxed
  renderer, per-service IPC registration (`registerXxxIpc`).
- Preload pattern: `contextBridge` exposing a typed `window.*` API
  (`invoke` for requests, `on` + unsubscribe for pushed updates).
- Renderer pattern: icon sidebar + header + `useState` page routing,
  centralized design tokens (`lib/tokens.ts`), dark theme.

Kept: the whole skeleton above, the tokens pattern, the dark theme.
Changed: the starter's pages/services (downloads, converter, reader,
RSS, optimizer, storage) are replaced by Omega pages + one `puppy`
service; the Mac target was added to electron-builder (the starter
only configured Windows NSIS); app name/id are Puppy Omega One
(`com.ant.puppy-omega-one`).

Theme follows Ant's standing taste: polished, modern, dark-mode-first,
relatively borderless, less excessively rounded — background `#0b0e11`,
surfaces `#12161b` / `#171d24` / `#1f262e`, 1px borders, 8px radius,
orange accent `#f5a524`, green `#22c55e` pass / red `#ef4444` fail.

## Verified puppy_gui endpoints (wired)

Read from `puppy_gui` v0.16.2 `static/js/api.js` and the service layer:

| Endpoint | Used by |
|---|---|
| `GET /api/health`, `GET /api/status` | server status pill, spawn wait |
| `GET /api/agents`, `GET /api/models`, `GET /api/models/active` | Run page (agent/model shown), Live page |
| `GET /api/sessions`, `GET /api/sessions/active` | Live page (raw session poll) |
| `GET /api/cost/active` | cost read (wired, not yet surfaced in a view) |
| `GET /api/agents/switch`, `/api/models/generation`, `/api/sessions/active/compact`, `/api/sessions/save`, `/api/sessions/export`, `/api/config`, `/api/skills/install`, `/api/mcp/servers`, `/api/memory`, `/api/tools` | available via the embedded Puppy GUI view (no native UI yet) |

## What each view shows, per run stage

| View | Before a run | During a run | After a run |
|---|---|---|---|
| **Run a job** | Goal + "Done when:" inputs, worker picker with default tiers, Compose brief | Brief text + Copy | Draft saved locally; no automatic dispatch |
| **Live run** | "No runs yet" | Worker cards: agent, model, status chip, check pass/fail | Final statuses + result summaries |
| **Briefs** | Empty | Each delegation record, expandable brief text | Check results per worker |
| **Progress** | Pick a project folder | `docs/progress.md`, `decisions.md`, `known-issues.md` as written | Same — the session-end ritual's output |
| **Puppy GUI** | Real puppy_gui UI in a `<webview>` | Chat + nested worker cards (the actual run feed) | Sessions, cost, models |

## Wired vs stub

| Piece | State |
|---|---|
| Explicit server attach/launch, passive startup health poll, owned-child shutdown | **Wired** (`src/main/services/puppy.ts`); no automatic spawn on app open |
| Agents / models / sessions / cost reads | **Wired** (verified `/api/*` above) |
| Draft records (`runs.json` in Omega userData, written atomically) | **Wired** — user selects a guarded project workspace; composing does not launch agents |
| Progress docs read from a project folder | **Wired** |
| Puppy GUI embedded (`<webview>` to 127.0.0.1:8765) | **Wired** |
| Run-page brief compose + copy | **Wired** (interim trigger — see below) |
| Sending a prompt into a session | **Stub** — `puppy:sendPrompt` throws a "not wired yet" error on purpose |
| Read-only live worker event monitor | **Integrated (runtime compatibility pending):** `src/main/services/workflow.ts` connects to loopback `ws://127.0.0.1:<port>/ws/chat` and publishes bounded, typed event summaries over IPC; Overview → Live. The installed GUI server must support that path. |

**Interim trigger:** until send is wired, the Run page composes and
persists a **draft** brief — you paste it into the Puppy GUI chat with
the `omega-orchestrator` agent. Drafts are not evidence of launched work,
and the live page does not infer worker completion from draft records.

**Send still pending:** `puppy_gui/static/js/chat.js` uses `ws://<host>/ws/chat` and sends `{action: "prompt", text}`; `service/chat_runtime.py` publishes structured sub-agent lifecycle messages. However, the current public `puppy_gui` repository tree does not include the `api/routes_chat.py` file imported by `app.py`, so the server-side route implementation cannot be independently verified from that revision. This desktop shell therefore **subscribes read-only** to the documented client stream while leaving `puppy:sendPrompt` intentionally disabled until the installed server implementation can be tested. A subscription that fails to connect remains visibly **disconnected**; it is never presented as running agents.

## Branding

- `assets/logo.png` — the logo art: the powered-up Border Collie,
  glowing cyan eyes, cyan/violet neon aura crackling off his body, the
  Omega formed by his energy. Top of the repo README; the app's
  branding art (about page, splash, docs).
- `assets/icon.png` — the minimal neon-Omega + puppy-face mark. It
  fits as the small app icon: it is the `BrowserWindow` icon
  (`src/main/main.ts`) and the electron-builder icon source
  (`"icon": "../assets/icon"`, assets copied in via `extraResources`).
  Packaging caveat: electron-builder wants `icon.icns` (Mac) and
  `icon.ico` (Windows) for installer icons — generate those from
  `assets/icon.png` and drop them next to `icon.png` before
  `npm run dist`. The PNG alone covers the running window icon and
  the Linux build.

## Run / build

```bash
cd electron
npm install
npm run dev        # electron-vite dev; needs Code Puppy installed
npm run build
npm run dist:mac   # .dmg
npm run dist:win   # NSIS .exe
```

Env: `CODE_PUPPY_PYTHON` (venv python path),
`PUPPY_GUI_LAUNCH` (full path to `launch_gui.py`) or `PUPPY_GUI_DIR`,
`PUPPY_GUI_PORT` (default 8765).

## Sources

- `ant3869/electron-react-dark-starter` — Electron shell starter
  (structure, main/preload/renderer, tokens, dark theme).
- `ant3869/ai-integration-reference` — backend wiring reference:
  `harnesses/code-puppy.md` (no stable programmatic API on the CLI;
  MCP + custom agents are the extension surface),
  `architecture/session-and-events.md` (run/delegation-record/state-
  machine design), `COMPATIBILITY.md` (wire contracts, capability
  matrix — Code Puppy has the lightest contract of the harnesses).
- `ant3869/puppy_gui` v0.16.2 — the FastAPI server this shell wraps
  (verified `/api/*` endpoints, ChatBridge streaming).
- `mpfaffenberger/code_puppy` (HEAD) — the runtime underneath.


## Command center dashboard (UI preview)

The Electron shell now opens on **Overview**, with a workflow diagram based on \`reference/omega-setup-recreation.html\`. The graph follows goal → orchestrator → researcher/builder/tester/reviewer → individual checks → orchestrator verification. Worker cards are selectable by pointer or keyboard. A left navigation rail retains the run composer, embedded Puppy GUI chat, saved activity, briefs, and project docs; a Settings button stays at its bottom.

Two explicitly different data modes exist:

- **Demo:** timed highlights and connector pulses illustrate how orchestration *could* proceed. The UI labels this \`SIMULATED · NOT LIVE\`. Animation can be paused/restarted and stopped under Settings → Reduce animations.
- **Saved runs:** worker and check statuses come only from local `runs.json` records. A draft does **not** imply that a worker was dispatched. The graph labels this `LOCAL RECORDS · NOT TELEMETRY`.
- **Live:** a read-only WebSocket observer connected from the Electron main process consumes `turn_start`, `turn_end`, `error`, `request`, and `SubAgent*Message` events. Only recognized worker IDs are projected onto the map; a worker response is labeled **responded**, never **check passed**. An offline stream shows no live progress. Critical requests/errors are surfaced with a link to the embedded harness chat. The last 30 event summaries are retained in memory, with no full transcript stored by Omega.

System health reflects the existing \`/api/health\` probe, not individual agent liveness. Once a verified streaming event contract is implemented, an event adapter can replace the illustrative demo engine and map actual run/delegation events to graph node states. **Do not** infer agent progress from a raw session JSON blob.

The Settings page currently supports reduced-motion preference and reconnecting the local GUI server; model, agent, and session configuration is available in the embedded Puppy GUI, not silently duplicated in the shell. The native chat-send IPC endpoint is still deliberately unavailable until its endpoint has been verified.


## Live event projection and testing

`electron/src/shared/workflow-events.ts` is a pure typed reducer. It deliberately ignores unrecognized event kinds, limits displayed excerpts, tracks explicit connection state and keeps only a bounded in-memory recent activity list. No automatic completion or check-success assumptions are made based on end-of-turn or subagent responses.

`electron/src/main/services/workflow-transport.ts` owns the loopback WebSocket connection and reconnects after disconnects; `services/workflow.ts` exposes the read-only IPC projection. The sandboxed renderer receives only typed projection snapshots through a fixed preload IPC channel; raw WebSocket access, prompt text and response/approval actions are not exposed by this new bridge.

Run `cd electron && npm test && npm run typecheck && npm run build`. The unit tests cover start/delegation/response, errors, approval requests (including password prompt suppression), bounded activity and cancellations. A separate WebSocket integration suite starts an actual loopback `ws` server, verifies runtime events are projected without sending messages back, and tests disconnect/reconnect and loopback-only endpoint restrictions. CI runs those checks. Manual GUI stream compatibility must still be tested against the installed `puppy_gui` server.
