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

## Core isolation and workspace scope

Omega installs **only project-local templates**. The PowerShell and shell installers reject the user profile, Code Puppy global config, known Python virtual environment paths, and redirecting junctions/symlinks before writing any files. The Electron app starts without launching Code Puppy and validates selected project workspaces in its main-process IPC handlers. Drafts are stored under Omega's own Electron userData, not Code Puppy configuration.

The **Compose run** page requires a selected workspace and embeds a core-isolation instruction in every generated brief. Every Omega worker agent manifest also carries the restriction, since delegated workers do not inherit AGENTS.md. These are behavior instructions, **not** a filesystem security boundary. Agents using unrestricted shell tools can still modify files permitted by the OS account. Omega does not install/upgrade Code Puppy or edit its global settings.

**Project-bound startup:** Omega shares a validated project folder between the run composer and the chat launcher. An explicit GUI launch now starts the existing `launch_gui.py` with its **working directory set to that selected project**, and passes the GUI's supported `--host`, `--port`, and `--no-browser` CLI flags. No other Code Puppy files are patched by Omega. If an already-running GUI is found, Omega does **not** restart it or claim its working directory; the chat view warns that the external workspace is unknown or different. Users must confirm the runtime's actual project before approving write-capable tasks. Native prompt-send remains disabled. Starting an installed GUI could still cause that underlying runtime's normal state changes; this is not an OS sandbox.

Tests include negative installation into home/core, symlink and Windows junction redirection checks, workspace selection guard tests, and normal-project install smoke checks.

## Overview chat dock and guarded embedded GUI

The overview's **Open chat beside flow** button opens a responsive side dock with the existing Puppy GUI webview while the workflow animation stays visible. **Open full chat** switches to the full-width embedded GUI. Opening the dock selects Live visual mode, rather than implying a simulated Demo sequence is the active runtime. The WebSocket observer remains read-only; its events are not yet guaranteed to correspond to the same GUI session.

This is the **real embedded Puppy GUI chat interface**, not a newly implemented native prompt-send endpoint. The desktop shell still does not issue prompts, approvals, model changes, package installs, or agent dispatch automatically. Native chat-send remains disabled until the installed server's route and session binding can be verified.

When the GUI is already running from a working directory Omega cannot verify, the embedded chat is **locked behind an explicit per-project acknowledgement**. The user must select a project, review the mismatch/unknown-cwd warning, and choose to open the existing GUI. That acknowledgement is reset when the selected project or known GUI ownership changes. An Omega-owned launch with a matching requested project is distinguished from an external server, but that launch cwd does **not** prove the runtime has retained the same cwd after startup. This UI barrier is not a security sandbox.

The main process now restricts embedded webview initial URLs, navigation and redirects to the configured `http://127.0.0.1:<port>` origin. Browser-safe external links, when opened by the GUI, go through the host browser rather than navigating the embedded privileged surface. Renderer isolation, sandboxing, and denial of arbitrary preload scripts remain in place. Policy and access decisions are covered by unit tests.

Manual QA still needed: check the GUI's responsive chat layout inside the dock, the installed runtime's actual current project, live-event/session association, and file-writing behavior with an intentionally disposable test project.

## Read-only runtime diagnostics (Settings)

Settings → **Run connection checks** performs four bounded, explicitly **GET-only** requests to `http://127.0.0.1:<configured-port>`: `/api/health`, `/api/agents`, `/api/models`, and `/api/sessions/active`. The main process uses a fixed allowlist, disables redirects and credential forwarding, times out each request, and returns **only** status, result category, and duration. It does not expose endpoint bodies, credentials, transcripts, model settings or secret error messages to the UI.

The diagnostic page also displays a snapshot of the read-only WebSocket observer's connection state and whether the GUI was launched by Omega for a known project. A positive HTTP result means **that an endpoint responded with JSON**, not that the chat-send API is compatible, an individual agent is healthy, or the current runtime's working directory is independently attested.

Diagnostics is initiated explicitly by the user and **never** starts the GUI, sends prompts, approves tools, edits agent config or touches the Code Puppy installation. The checks have Node tests with a disposable loopback HTTP server verifying the exact allowlist, GET-only behavior, error classification and suppression of response bodies. The real installed server remains to be manually tested before any native dispatch API is enabled.

## Saved activity / draft record integrity

**Saved activity** now shows a searchable local history rather than only the most recent entry. Users can search by goal, acceptance criteria or workspace, inspect each draft's worker briefs and recorded check fields, **copy a previously composed brief after app restart**, and open embedded harness chat to paste it manually. Local run history is never interpreted as live telemetry. Raw active GUI session JSON is no longer displayed on this page.

The Electron `runs:save` IPC now accepts **drafts only**. The main process validates required goal, `Done when`, selected workspace, timestamps, unique worker IDs, known worker lanes, brief size and the absence of manufactured execution/check results. It then validates the workspace against the existing core-isolation boundaries. A renderer cannot save `completed`, `running`, `check pass` or an approval claim through this draft path. Historical records may still display older stored statuses, clearly labeled **saved / not independently verified**.

History JSON is checked for malformed run/worker structures before being sent to the renderer. **Legacy history is read permissively**: older long goals, long briefs, and more than 2,000 records remain readable. Size limits apply only when writing new drafts; the app does not truncate or silently delete saved history. Corruption is surfaced as an error and the original `runs.json` is **not overwritten** by a failed read. This is not a backup system or a guarantee against OS-level file damage. No Code Puppy core/configuration or external GUI files are modified; only Omega's app-local userData holds the draft records.

Automated tests cover valid drafts, fake completion claims, oversized/duplicate worker records, invalid workspace data, corrupt history and older saved statuses. Native chat-send remains disabled pending end-to-end server/session verification.
