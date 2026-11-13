# Direct Code Puppy ACP — safe local verification

**Manual checklist, not a claim these checks passed.** Work only in a
disposable project, outside Code Puppy core/config/venvs, with no secrets
or important source changes.

## Build

From `electron`:

```powershell
npm install; npm test; npm run typecheck; npm run build; npm run verify:build
```

Then `npm run dev` to open the Electron application. Verify the main/preload
build paths are `out/main/index.js` and `out/preload/index.js`, and no blank
window or preload error occurs.

## Installed runtime ACP test

- [ ] Confirm your installed `code-puppy --acp` advertises ACP and note its
  version. If not on PATH, set `CODE_PUPPY_EXECUTABLE` to the exact executable.
- [ ] Choose a disposable **project** folder and click **Start Code Puppy**.
  The status should become READY and show a nonempty session ID in Settings.
- [ ] Submit a harmless prompt, e.g. "Explain the files in this test folder
  without changing any files." Check text streaming and the final turn status.
- [ ] Verify no separate GUI process, webview, localhost server, or second
  monitor WebSocket was started.
- [ ] With an agent task in progress, request Cancel. Record whether it
  stops and what the next prompt does; do not assume cancellation without
  seeing a completed turn/stop reason.
- [ ] Trigger a harmless approval-required action in the disposable folder.
  The client should deny the request until the approval UI exists. Inspect
  the folder afterwards; confirm no unexpected changes.
- [ ] Choose a new project and ensure the old owned child was stopped;
  no previous-session stream should appear under the new project.
- [ ] Open Omega loop: Chat remains mounted; Demo is clearly simulated;
  Saved entries stay draft-only. Enable Live and confirm the observed
  turn/tool summary belongs to the same ACP chat session. Individual worker
  success is **not** inferred from a finished turn.
- [ ] Test missing Code Puppy executable, unexpected exit, invalid cwd and
  disconnected state. Ensure errors appear without revealing credentials.
- [ ] Test keyboard focus, responsive layout, reduced-motion Demo controls,
  restart and app exit. Check that closing Omega stops only its owned child.

## Safety boundary

Even when ACP client permission requests are denied, Code Puppy plugins
and tools may run under your account. This is not a filesystem sandbox.
Never run destructive tests against global Code Puppy configuration or a
real project. Save only redacted evidence in public PR comments.
