# Puppy Omega One — Electron desktop console

The Electron/React console adds a functional UI around **a separately
installed Puppy GUI**. It is more than an empty starter shell, but
**not yet** a native autonomous dispatch implementation. See
[Current status](../docs/STATUS.md), [Frontend architecture](../docs/FRONTEND.md)
and [Changelog](../CHANGELOG.md).

## Start and test

```bash
cd electron
npm install
npm test
npm run typecheck
npm run build
npm run dev
```

The console can open **without** a Code Puppy installation for Demo mode,
local saved records and UI inspection. Live embedded chat and actual
model/session behavior require your own installed Puppy GUI and Code
Puppy. Omega **does not install or upgrade them**.

Optional environment variables: `PUPPY_GUI_PORT` (default 8765),
`CODE_PUPPY_PYTHON` (path to installed runtime's Python),
`PUPPY_GUI_LAUNCH` (path to `launch_gui.py`) or
`PUPPY_GUI_DIR` (its directory). These must point at your existing
installation, **not** a copy of core bundled in Omega.

## What you can do

| Location | Behavior |
| --- | --- |
| Overview | Animated diagram with clearly labeled Demo, Saved and Live modes |
| Overview → Open chat beside flow | Dock the existing Puppy GUI webview beside the animated map |
| Compose run | Select guarded project, set goal / `Done when:`, compose a **draft** |
| Saved activity | Search historical draft records; inspect/copy briefs and open chat |
| Event log | Inspect the 30 most recent sanitized event summaries with severity/worker/search filters |
| Worker briefs | Read locally stored worker briefs/check records |
| Project documents | Read guarded workspace progress/decision/known-issue files |
| Settings | Reduce animations, read-only GUI diagnostics, safety notes |
| Overview → Live | Click **Connect monitor** to begin local read-only event observation |

**No automatic chat observer connection, GUI launch, native send or
approval at startup.** Live Monitor is off until you explicitly connect.
Clicking **Stop monitor** closes it and cancels retries. A received event
does not prove it belongs to the same chat session; a worker response
does not prove a check passed.

For actual chat, select a safe project in Harness Chat and **explicitly**
start the existing GUI or acknowledge an existing external GUI's unknown
working directory. You type and submit prompts inside the existing GUI
webview. Omega's `puppy:sendPrompt` IPC stays deliberately disabled.

## Safety boundary

- Installers and workspace picker guard against known Code Puppy core
  directories, Python virtualenvs, global config and GUI source checkouts.
- Omega keeps draft history in its **own** Electron `userData`, not
  Code Puppy's config. New saves are draft-only and reject forged
  completions/check passes. Legacy long histories remain readable.
- Embedded chat navigation is restricted to the configured loopback GUI
  origin. It runs in a sandboxed/context-isolated Electron renderer.
- The **installed GUI may update its own state** when explicitly launched
  or connected. Shell-enabled agents run with your OS permissions.
  **Omega is not an OS-level sandbox** and cannot guarantee isolation
  from actions the external runtime chooses to execute.

See [safe local QA](../docs/LOCAL_QA.md) before trying native dispatch or
destructive tests. Those tests have **not** yet been completed against
your installed GUI.

## Project structure

```text
electron/
  src/main/main.ts                Electron window and guarded webviews
  src/main/services/puppy.ts      Existing GUI attach/launch, GET IPC, drafts
  src/main/services/workflow.ts   Explicit live-observer IPC lifecycle
  src/main/services/diagnostics.ts    GET-only local endpoint checks
  src/main/services/draft-validation.ts  Draft write and history read validation
  src/main/services/project-safety.ts    Protected workspace guard
  src/preload/index.ts            Typed window.omega bridge
  src/shared/                    Run, monitor and diagnostic contracts
  src/renderer/src/App.tsx        Overview-first navigation and dock
  src/renderer/src/pages/        Overview, Run, Live, Briefs, Progress, Chat, Settings
```

## Build and packaging

```bash
npm run build
npm run dist:win
npm run dist:mac
```

The `electron-builder` config declares NSIS and DMG targets. Platform
installer creation, installation and first-launch behavior still need
manual tests; a passing `npm run build` is **not** package verification.
Some packaging configurations may require `assets/icon.ico` or
`assets/icon.icns` derived from `assets/icon.png`.

Automated GitHub CI runs Electron typechecking, Node tests and the
production Vite bundle, plus the Linux/Windows installer safety tests.
See the [tracking issue](https://github.com/ant3869/puppy-omega-one/issues/4)
for remaining work.
