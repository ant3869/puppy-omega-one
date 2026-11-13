# Safe local GUI verification checklist

This is a **manual checklist**, not evidence that any of the steps have
already passed. Run it only in a disposable test project, with an installed
Code Puppy / Puppy GUI environment you control. Back up important config and
avoid real credentials in screenshots or logs.

## Preparation

- [ ] Use a fresh **disposable** project folder, outside Code Puppy core,
  global config, GUI checkout and Python environments.
- [ ] Verify the installed `launch_gui.py` path and Python interpreter.
  Record exact local versions; do not assume the public source matches.
- [ ] Keep a record of the config, agent and runtime directories you need
  to protect. Do not put secrets into issue comments or public PRs.
- [ ] Run `cd electron && npm test && npm run typecheck && npm run build`
  and the platform-appropriate installer smoke tests, if available.

## Windows Electron startup verification

After a clean build, from `H:\projects\puppy-omega-one\electron`:

```powershell
npm test
npm run typecheck
npm run build
npm run verify:build
Test-Path .\out\main\index.js
Test-Path .\out\preload\index.js
Get-Content .\out\preload\index.js -TotalCount 8
$env:ELECTRON_ENABLE_LOGGING='1'; npm run dev 2>&1 | Tee-Object "$env:TEMP\omega-electron-dev.log"
```

- [ ] Chat/Omega renders in the actual window; no blank dark content.
- [ ] Main and CommonJS preload build artifacts exist.
- [ ] The application loads `index.js`, not stale `index.mjs`.
- [ ] Logs lack `Unable to load preload script`, `Cannot use import statement outside a module`, and `window.omega` undefined / React TypeError.
- [ ] A nonexistent child under a protected GUI checkout is still rejected.

The user reports an agent tested PR #20 and found it good. Original
local logs/screenshots have not been independently reviewed here;
CI artifact verification is **not** a replacement for this checklist.

## Safe read-only preflight (optional, before active observation)

From the project root, with Python 3 installed and an **existing**
`puppy_gui` checkout:

```powershell
python .\tools\inspect_chatbridge.py --gui-root "C:\path\to\puppy_gui" --offline
```

With the local GUI **already running**, omit `--offline` to additionally
perform only `GET /api/health` and `GET /openapi.json` on
`http://127.0.0.1:8765`. Set `--origin http://127.0.0.1:PORT` for
a custom loopback port. No prompts, approvals, WebSockets or session
mutations are requested by the inspector.

- [ ] Record whether the **installed** checkout contains
  `code_puppy_gui/api/routes_chat.py`. This is a file-presence check,
  **not proof** of the chat protocol.
- [ ] Record loopback health and known REST route-presence flags.
- [ ] Do **not** treat OpenAPI as evidence of a WebSocket route:
  websocket endpoints are normally absent from that REST schema.

## Observe without submitting a task

- [ ] Launch Omega. Confirm it **does not spawn Code Puppy** or open an
  extra ChatBridge WebSocket on startup.
- [ ] Confirm **Chat opens first**; switch Chat → Omega loop → Chat
  without resetting the same conversation surface. Check that Omega
  mode retains a readable chat alongside the graph and the draft drawer
  can be opened/closed without dispatching work.
- [ ] Inspect Omega loop → Demo, pause/restart, reduced motion, and Saved runs.
  Confirm every simulated/local status is labeled accordingly.
- [ ] With an existing disposable-project GUI running, click **Refresh
  context** in Chat. Compare the reported agent/model/saved-session names
  against the installed GUI and verify no model, agent or session changed.
  Test an unavailable route and confirm it displays **Not reported**;
  no raw tools, credentials or transcript bodies appear in DevTools/IPC.
- [ ] Switch to Omega mode and confirm the same context bar is present,
  without implicitly refreshing it or opening the monitor socket.
- [ ] In Settings, use **Run connection checks** only if the separate GUI is
  already running. Record HTTP result codes, not response bodies.
- [ ] In Omega loop → Live, explicitly select **Connect monitor**. Confirm
  connection state and check whether the GUI creates/modifies a session.
  **Stop monitor** must close the socket and stop retries.
- [ ] Open the **Event log** from the sidebar. Filter by severity/worker,
  search a known synthetic summary and check newest-first ordering. Confirm
  the view does not persist a transcript and no connection opens until
  you explicitly choose Connect monitor.
- [ ] Try a disconnected GUI and a rejected/invalid configured port.
  No worker should appear live because of a draft or stale event.

## Verify project and chat boundaries

- [ ] Choose the disposable folder and explicitly start the existing GUI.
  Verify the **actual runtime working directory**, not only Omega's launch
  `cwd`; confirm the project-local Omega agents load.
- [ ] With an already-running external GUI, confirm Omega warns that
  session/project identity is unknown, and requires acknowledgement.
- [ ] Check conversation pane in Chat and Omega mode; inspect focus, viewport sizing,
  scroll, keyboard, select/copy, approval dialogs and the narrow-window layout.
- [ ] Create a **harmless** brief (for example, list files in the disposable
  project). Submit it manually in the embedded GUI only after confirming the
  correct project and selected agent.
- [ ] Check whether the read-only monitor reports the same turn/session.
  Record event kinds/IDs in **redacted, synthetic** fixtures rather than
  pasting actual prompts or API tokens into the public repo.
- [ ] Disconnect/reconnect and cancel a harmless turn. Stale worker activity
  must not resume as a new running task.

## Verify isolation and shutdown

- [ ] Check that Omega's installer/picker rejects protected paths, including
  relevant virtualenvs, GUI checkouts and redirected symlinks/junctions.
- [ ] Confirm no package installation, core patching or global config
  mutation was initiated by Omega. A manually launched GUI may still perform
  its own initialization writes: document those separately.
- [ ] Close Omega. Confirm it stops only a GUI process it launched and never
  kills an independently started server.
- [ ] Test `npm run dist:win` or `npm run dist:mac` on a safe build machine;
  verify app icon, install/uninstall and first launch. Package success is not
  established by `npm run build` alone.

## Completion evidence

Record exact project path **only if non-sensitive**, installed runtime version,
pass/fail for each item, redacted event-contract observations, screenshots and
any failures in the tracking issue. Do **not** enable native prompt dispatch
until session/workspace binding and approval ownership are proven.
