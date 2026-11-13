# Electron console: implementation and integration boundaries

> **Current source-of-truth (2026-11-12):** This page describes code merged
> into `main`, not a verified installed GUI protocol. See [STATUS.md](STATUS.md),
> [LOCAL_QA.md](LOCAL_QA.md) and the [changelog](../CHANGELOG.md).
> The Electron shell is implemented, but native dispatch and real-runtime QA
> are **not complete**.

## Components

```text
Puppy Omega One (Electron main + sandboxed React renderer)
  ├─ Overview: interactive SVG workflow, Demo / Saved / Live
  ├─ Compose: local draft with goal, done-when check, worker selection
  ├─ Saved activity: searchable draft history, inspect/copy/open chat
  ├─ Event log: bounded, sanitized observation summaries and filters
  ├─ Worker briefs + project progress docs: local records/files
  ├─ Settings: reduce motion, four read-only endpoint probes
  ├─ Optional Live Monitor: explicit read-only WebSocket observer
  └─ Harness chat: restricted <webview> showing installed puppy_gui
                      │
          http://127.0.0.1:PORT (existing GUI only)
                      │
         separately installed puppy_gui → Code Puppy
```

There is **no second orchestration backend**. The main process owns desktop
IPC, Omega-local draft persistence, GUI process lifecycle and an opt-in
WebSocket observer. Code Puppy and Puppy GUI installations are never patched
by these code paths.

Important distinction: the actual `<webview>` is a separately installed
GUI, not a verified native Omega chat/send implementation. **Opening chat
can perform actions inside that installed GUI if the user submits them.**

## Honest user-visible states

| View | Works today | Limit |
| --- | --- | --- |
| Overview → Demo | Deterministic animation; pause/restart/reduced motion | Clearly labeled simulated; no real task dispatched |
| Overview → Saved | Uses Omega's own `runs.json` data | Recorded statuses are **not live telemetry** |
| Overview → Live | Bounded event summaries, worker states, errors, approval alerts | **Off by default**; session association unverified |
| Compose run | Goal/acceptance check/project picker, worker selection, draft save/copy | Never sends a prompt or starts a worker |
| Saved activity | Search, full history, details, copy brief, open GUI chat | Older statuses remain unverified saved data |
| Event log | Search/filter recent sanitized activity and opt in to monitoring | 30 in-memory entries; no raw transcript persistence, session binding unknown |
| Worker briefs | Expandable local record view | No independent check verification |
| Project docs | Reads selected `docs/progress.md`, `decisions.md`, `known-issues.md` | Does not write project docs |
| Harness chat | Existing Puppy GUI in a guarded full page or dock | Requires separate installation; behavior depends on that GUI |
| Settings | Reduced-motion preference; read-only diagnostics; safety context | Not a global model/config editor |

### Session and telemetry caveat

`electron/src/main/services/workflow-transport.ts` is an **observer** for
`ws://127.0.0.1:<port>/ws/chat`. Clicking **Connect monitor** starts
observation; **Stop monitor** closes the socket and cancels reconnects.
Omega **does not** connect this observer at desktop startup or merely when
opening chat. It never sends prompts or approval responses.

A WebSocket handshake proves only that a socket opened, **not** which GUI
session or project it represents. The event reducer maps recognized
`turn_start`, `turn_end`, `error`, `request` and
`SubAgent*Message` kinds into **bounded summaries**. A worker response
means **responded**, *not verified passed*. Disconnects invalidate
running-worker observations; cancellations stop pulses. The view never
promotes local draft records into live results. Raw transcripts are not
persisted by the Live Monitor.

**Why native send stays disabled:** The prior inspection of the public
`puppy_gui` client found a `{action: "prompt", text}` WebSocket shape,
but the matching server chat route/session contract was not available for
independent verification. `puppy:sendPrompt` deliberately throws.
The installed GUI must be tested for project binding, authentication,
session identity and approval ownership before enabling native dispatch.
Do not infer compatibility from a health 200 or browser chat alone.

## Startup, runtime ownership and project boundaries

- Opening Omega performs **no GUI launch and no ChatBridge observer connect**.
  It checks whether a local GUI health endpoint responds.
- In Harness chat, select a project folder. The Electron **main process**
  validates it against known home, global config, Python virtualenv and GUI
  source paths; installers reject redirecting links and protected targets.
- **Start GUI in this project** explicitly invokes the existing
  `launch_gui.py` with the selected directory as its process `cwd`,
  loopback host and configured port. An owned process is stopped on Omega quit.
- If an **external GUI** is already running, Omega does not restart or
  re-home it; its actual `cwd` is unknown. The user must acknowledge the
  warning before opening its chat webview.
- Even for a child Omega launched, the selected spawn `cwd` is not proof
  that the GUI/runtime has retained that working directory after startup.
  Verify it manually before running write-capable work.

**These checks are not OS sandboxing.** A Code Puppy agent with shell tools
or the separately installed GUI may write anything its OS account can
access. Normal GUI startup may update its own state; Omega does not claim
otherwise. Use disposable projects for testing.

## IPC and persistence

The renderer accesses a restricted `window.omega` preload bridge:

| IPC family | Behavior |
| --- | --- |
| `puppy:getStatus` | Health probe; reports known ownership metadata |
| `puppy:ensureServer` | Explicit GUI launch/attach for a validated project |
| `puppy:diagnostics` | Four GET-only loopback probes (below) |
| `puppy:listAgents/listModels/listSessions/getCost` | API read passthrough; actual runtime responses unverified |
| `workflow:get/connect/disconnect` | Opt-in read-only socket lifecycle |
| `runs:list/save` | Local Omega app `userData/runs.json` |
| `app:pickProject`, `docs:read` | Guarded project selection and read-only progress docs |
| `puppy:sendPrompt` | **Not wired; throws intentionally** |

`runs:save` validates a **draft-only** input, including goal, done-when
check, selected safe project, timestamps, known workers, bounded text and
null check/outcome fields. A renderer cannot turn a draft into a
`running` / `completed` run or fabricated check pass via that IPC.
Files are written under Omega's Electron `userData`, **not**
`~/.code_puppy`, with a temporary file/rename operation.

`runs:list` accepts older, longer records and history exceeding 2,000
entries for backward compatibility. It validates basic record shapes and
surfaces corrupt JSON as an error rather than silently resetting/wiping the
file. Existing historical completion fields are presented as **saved
records**, not independently attested execution.

### Read-only diagnostics

Settings → **Run connection checks** explicitly sends GET requests to
`/api/health`, `/api/agents`, `/api/models` and
`/api/sessions/active` on `http://127.0.0.1:<configured port>`.
They have bounded timeouts, disabled redirects/credentials and discarded
response bodies; only outcome, HTTP status and duration reach the UI.
The status panel also shows whether the observer was enabled and whether
the GUI's known launch path belongs to Omega. This **does not**
validate chat-send compatibility or actual runtime project identity.

### Webview constraints

The main Electron process checks initial webview URLs and subsequent
navigation/redirects against the configured loopback GUI origin,
removes unexpected preload scripts, and enables renderer sandbox and
context isolation. External HTTP(S) links are opened via the OS browser
instead of navigating the embedded GUI. This is defense-in-depth,
**not proof that an untrusted local GUI is safe to run**.

## Developer workflow

```bash
cd electron
npm install
npm test
npm run typecheck
npm run build
npm run dev
```

For packaged installers, use `npm run dist:win` or
`npm run dist:mac` on a compatible machine, then perform actual
installer smoke tests. `npm run build` alone does **not** certify
NSIS/DMG packaging.

Configuration: `PUPPY_GUI_PORT` (default `8765`),
`CODE_PUPPY_PYTHON` (existing Python interpreter),
`PUPPY_GUI_LAUNCH` (existing `launch_gui.py` path) or
`PUPPY_GUI_DIR`. No automatic model/config setup is performed.

Automated CI covers Linux/Windows installers and their safety cases,
Electron typecheck/build, reducer and WebSocket tests, URL/navigation
policy, draft validity/backward-compatibility and loopback diagnostic
behavior. **Not covered:** installed runtime, native send, real
session/project binding, manual visual UI, or shipped packages.
See [LOCAL_QA.md](LOCAL_QA.md) before treating those as complete.

## Background references

This shell was adapted from `ant3869/electron-react-dark-starter`.
The overall architecture follows
`ant3869/ai-integration-reference`, which cautions against assuming
a stable RPC/session API for the raw Code Puppy CLI. The source of truth
for Omega's code is now this repository's **merged code and tests**,
not a historical screenshot or an untested provider claim.
