# Current implementation status

> Updated 2026-11-12 from the merged `main` code and PR/CI history.
> **Code-level checks passed; installed-runtime behavior and visual QA remain
> unverified.** This is not a release-readiness certificate.

## Electron startup regression fixes

PR #20 fixed the Electron entrypoint, sandboxed CommonJS preload,
and Windows protected-workspace canonicalization of nonexistent descendants.
PR #21 adds automatic build-artifact checks and negative tests.
The main process points to `out/preload/index.js`; Electron's sandbox,
context isolation and disabled Node integration remain intact.

GitHub CI verifies the build and test suite. A separate user-operated
agent reportedly confirmed the Windows window renders, but its original
logs and screenshots have not been independently inspected here.

## What works in the Electron shell

| Area | Status | Verification boundary |
| --- | --- | --- |
| Chat-first landing and app navigation | Implemented | Chat is the initial route; current transport remains the separately installed GUI; manual UX QA pending |
| Omega orchestration mode | Implemented UI | Switches the same chat workspace into a conversation + worker graph split view; Live session attribution pending |
| Demo workflow | Implemented, visibly simulated | Never presented as a real run |
| Omega keyboard and reduced-motion exploration | Implemented UI | Worker lanes can be selected using visible keyboard focus or native buttons; Reduce motion replaces autoplay with manually stepped Demo stages; manual accessibility QA still pending |
| Saved history and brief composition | Implemented | Local Omega `userData/runs.json` only; drafts do not submit prompts |
| Search/copy saved briefs, open chat | Implemented | Local history and clipboard; live send is manual |
| Embedded Puppy GUI chat | Integrated webview | Requires separately installed GUI; behavior belongs to that GUI |
| Embedded GUI conversation | Interim implementation | Chat and Omega reuse one mounted conversation component; first-party native chat is not yet implemented |
| Omega job preparation drawer | Implemented, draft-only | No automatic prompt dispatch; the user submits copied briefs in the installed GUI |
| GUI startup | Explicit user action only | Starts existing launcher with selected safe `cwd`; does not patch core |
| Existing/external GUI attachment | Implemented with warning | Actual external project `cwd` is unknown, not attested |
| Read-only local diagnostics | Implemented | Four allowlisted GET responses + observer status; bodies discarded |
| Optional local WebSocket ping preflight | Implemented test utility | Explicit consent and disposable runtime required; sends one fixed ping and records only whether a pong arrived; connection may mutate server state, session/project ownership remains unverified |
| Native Chat/Omega context chips | Implemented (manual refresh) | Three fixed GET-only endpoints, bounded sanitized agent/model/session names; cannot attest WebSocket session identity or switch runtime configuration |
| ChatBridge monitor | **Off by default** | User explicitly chooses Connect/Stop; socket receives event summaries only |
| Worker status visualization | Implemented projection | Event/session association remains **unverified** |
| Event log navigation | Implemented read-only event search/filter and monitor controls | Up to 30 in-memory summaries only; not session-attested or persisted |
| Native send, automatic dispatch/approval | **Disabled** | No verified server route/session binding |
| Platform installers / packaged binaries | Configured targets | Manual installation/package smoke test outstanding |

## Read-only compatibility inspection

`tools/inspect_chatbridge.py` checks optional local GUI **file presence**
and, unless `--offline` is selected, makes only two GET requests to an
explicit `http://127.0.0.1:PORT` origin: `/api/health` and
`/openapi.json`. It blocks redirects and rejects remote URLs; only
known REST endpoint-presence flags leave the inspector. No credentials,
transcripts, local file paths, WebSockets or runtime mutations are collected
by the report. Python unit tests run in CI with a disposable loopback
server. **This does not verify native chat/session support.**

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
