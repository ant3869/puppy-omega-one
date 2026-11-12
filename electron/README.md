# Puppy Omega One — Electron shell (starter)

Desktop front end for the Puppy Omega One harness, built on Ant's
`electron-react-dark-starter` (electron-vite + React + Tailwind, dark
mode). This is a **starter, not a finished app** — see
`../docs/FRONTEND.md` for what's wired vs stub.

## Branding

- `../assets/logo.png` — the logo art (the powered-up Border Collie:
  black-and-white, glowing cyan eyes, cyan/violet neon aura crackling
  off his body, the Omega formed by his energy — not a puppy standing
  in front of a symbol). It sits at the top of the repo README and is
  the app's branding art (about page, splash, docs).
- `../assets/icon.png` — the minimal neon-Omega + puppy-face mark.
  It fits as the small app icon: it is the `BrowserWindow` icon
  (`src/main/main.ts` resolves it) and the electron-builder icon
  source (`"icon": "../assets/icon"` in `package.json`, with the
  assets copied in via `extraResources`).
- One packaging caveat: electron-builder wants platform files for the
  installer icon — `icon.icns` (Mac) and `icon.ico` (Windows). Generate
  those from `assets/icon.png` (e.g. `electron-icon-builder` or any
  PNG→icns/ico converter) and drop them next to `icon.png` before
  `npm run dist`. The PNG alone covers the running window icon and
  the Linux build.

## What it is

A thin Electron shell that:

1. **Starts without spawning Code Puppy.** It detects an existing local
   `puppy_gui` server on `127.0.0.1:8765`. Clicking **Connect / start**
   explicitly attempts to attach or launch your existing GUI installation.
   Omega never installs or patches Code Puppy itself.
2. Shows Omega views (Run, Live, Briefs, Progress) as native React
   pages talking to that same server over HTTP.
3. Embeds the real puppy_gui web UI in a "Puppy GUI" view, so chat,
   agents, models, sessions, and cost all work exactly as they do in
   the browser.

## Run it

```bash
cd electron
npm install
npm run dev
```

For local GUI launch, Code Puppy must already be installed. Override its Python with
`CODE_PUPPY_PYTHON=/path/to/python`. The server port defaults to
8765 (`PUPPY_GUI_PORT` overrides). The project-folder picker rejects
paths that overlap known Code Puppy core/config/venv or GUI locations.
The run composer saves **drafts only** and repeats isolation instructions
in its output. Normal agent shell access is not an OS sandbox.

## Build it

```bash
npm run build
npm run typecheck  # tsc --noEmit
npm run dist:mac   # .dmg
npm run dist:win   # NSIS .exe
```

## Layout

```
electron/
├── package.json                 # electron-vite app, electron-builder mac dmg + win nsis
├── electron.vite.config.ts
├── src/
│   ├── main/
│   │   ├── main.ts              # window + puppy server lifecycle + IPC registration
│   │   ├── services/puppy.ts   # spawn/health/poll, /api passthrough, runs.json store
│   │   └── services/workflow.ts # read-only WebSocket event observer
│   ├── preload/index.ts         # contextBridge window.omega API
│   ├── shared/types.ts          # Run / DelegationRecord / Brief types
│   ├── shared/workflow-events.ts # pure, tested event-to-UI projection
│   └── renderer/
│       ├── index.html
│       ├── src/main.tsx
│       ├── src/App.tsx          # overview-first shell, chat, runs, docs, settings
│       ├── src/lib/tokens.ts    # dark theme tokens (bg, surfaces, orange accent, 8px radius)
│       └── src/pages/           # WorkflowOverview, Run, Live, Briefs, Progress, Puppy GUI, Settings
```

## What's wired vs stub

Wired: server spawn + health check, agents/models/sessions/cost reads
(verified puppy_gui `/api/*` endpoints), progress-file reads,
draft-brief persistence to `runs.json` (no automatic dispatch).

Live monitor: Overview → Live subscribes **read-only** to the local puppy_gui
ChatBridge WebSocket. It renders actual received worker events and flags
disconnection; worker responses do not count as passing verification checks.
The installed server endpoint still needs an end-to-end compatibility test.

Still stubbed: native chat-send and automatic run dispatch. The Run page
composes and copies a brief for pasting into the embedded Puppy GUI.
See `../docs/FRONTEND.md` for confirmed boundaries and setup details.

Run `npm test` for workflow event reducer regressions.
