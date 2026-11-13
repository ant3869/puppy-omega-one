# Current implementation status

> Updated 2026-11-12 from the merged `main` code and PR/CI history.
> **Code-level checks passed; installed-runtime behavior and visual QA remain
> unverified.** This is not a release-readiness certificate.

## What works in the Electron shell

| Area | Status | Verification boundary |
| --- | --- | --- |
| Landing screen, animation, navigation and settings | Implemented | Typecheck/build and reducer tests; manual visual QA pending |
| Demo workflow | Implemented, visibly simulated | Never presented as a real run |
| Saved history and brief composition | Implemented | Local Omega `userData/runs.json` only; drafts do not submit prompts |
| Search/copy saved briefs, open chat | Implemented | Local history and clipboard; live send is manual |
| Embedded Puppy GUI chat | Integrated webview | Requires separately installed GUI; behavior belongs to that GUI |
| Chat dock beside workflow | Implemented | Desktop UI/size verification pending |
| GUI startup | Explicit user action only | Starts existing launcher with selected safe `cwd`; does not patch core |
| Existing/external GUI attachment | Implemented with warning | Actual external project `cwd` is unknown, not attested |
| Read-only local diagnostics | Implemented | Four allowlisted GET responses + observer status; bodies discarded |
| ChatBridge monitor | **Off by default** | User explicitly chooses Connect/Stop; socket receives event summaries only |
| Worker status visualization | Implemented projection | Event/session association remains **unverified** |
| Native send, automatic dispatch/approval | **Disabled** | No verified server route/session binding |
| Platform installers / packaged binaries | Configured targets | Manual installation/package smoke test outstanding |

## Precise safety boundary

- Installers copy **project-scoped templates**. They block home/global
  Code Puppy config, identified virtualenv/GUI paths and redirecting links;
  preflight and regression tests cover representative paths.
- Electron startup does not auto-launch the installed GUI or open an extra
  ChatBridge observer connection. The user explicitly starts both.
- Run saving in Electron is **draft-only**. Neither a saved status nor a worker
  response is accepted as independently verified completion.
- External GUI working directories are **not inferred** from a health response.
  The UI requires acknowledgement before exposing an unverified session.
- Webview navigation stays on the configured 127.0.0.1 GUI origin.
- **These are guardrails, not a filesystem or process sandbox.** The installed
  GUI can perform its normal state writes, and shell-enabled Code Puppy agents
  may operate anywhere the OS user is permitted. Do not run destructive tests
  against your real Code Puppy configuration.

## What must happen before native dispatch

1. On a **disposable** project and a controlled local runtime, verify that
   the installed `puppy_gui` implements the claimed chat WebSocket route
   and determine whether merely connecting creates a session.
2. Verify the authenticated/authorized session selection, current working
   directory, agent selection, event IDs, reconnect/resume behavior, and
   who owns approvals. A socket open or `/api/health` 200 is insufficient.
3. Capture a redacted, minimal protocol fixture (no secrets/transcripts)
   and add a mock-server compatibility test. Only then design an explicit,
   user-confirmed dispatch action bound to a selected project/session.
4. Perform manual desktop smoke tests (dock sizes, focus, keyboard, pause,
   disconnected state, shutdown) and packaging checks.

Use [LOCAL_QA.md](LOCAL_QA.md) for the safe test sequence.
The tracking issue is [#4](https://github.com/ant3869/puppy-omega-one/issues/4).
