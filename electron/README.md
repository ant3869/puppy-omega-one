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

1. Spawns the existing `puppy_gui` FastAPI server (`launch_gui.py`,
   Code Puppy venv python) on `127.0.0.1:8765` — or attaches to it if
   it's already running. It does **not** start a second backend.
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

Needs Code Puppy installed (the venv python). Override it with
`CODE_PUPPY_PYTHON=/path/to/python`. The server port defaults to
8765 (`PUPPY_GUI_PORT` overrides).

## Build it

```bash
npm run build
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
│   │   └── services/puppy.ts   # spawn/health/poll, /api passthrough, runs.json store
│   ├── preload/index.ts         # contextBridge window.omega API
│   ├── shared/types.ts          # Run / DelegationRecord / Brief types
│   └── renderer/
│       ├── index.html
│       ├── src/main.tsx
│       ├── src/App.tsx          # icon sidebar shell (Run, Live, Briefs, Progress, Puppy GUI)
│       ├── src/lib/tokens.ts    # dark theme tokens (bg, surfaces, orange accent, 8px radius)
│       └── src/pages/           # RunPage, LivePage, BriefsPage, ProgressPage, PuppyGuiPage
```

## What's wired vs stub

Wired: server spawn + health check, agents/models/sessions/cost reads
(verified puppy_gui `/api/*` endpoints), progress-file reads,
run-record persistence to `runs.json`.

Stub: sending a prompt and streaming live run events. The Run page
composes the brief and copies it for you to paste into the Puppy GUI
chat until the chat-send path is wired — the exact file to check is
`routes_chat` + `static/js/chat.js` in puppy_gui. See
`../docs/FRONTEND.md` for the full table.
