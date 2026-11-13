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

## Observe without submitting a task

- [ ] Launch Omega. Confirm it **does not spawn Code Puppy** or open an
  extra ChatBridge WebSocket on startup.
- [ ] Inspect Overview → Demo, pause/restart, reduced motion, and Saved runs.
  Confirm every simulated/local status is labeled accordingly.
- [ ] In Settings, use **Run connection checks** only if the separate GUI is
  already running. Record HTTP result codes, not response bodies.
- [ ] In Overview → Live, explicitly select **Connect monitor**. Confirm
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
- [ ] Open chat dock and full-page chat; check focus, viewport sizing,
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
