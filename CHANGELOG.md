# Changelog

This changelog tracks **merged repository changes**, not releases or claims that
an installed Code Puppy runtime has passed end-to-end testing.

The Electron package currently declares version `0.1.0`; no release
artifact or installed-runtime QA is implied by that version.

## Unreleased — repository main (2026-11-12)

### Electron startup fix and verification (PRs #20–#21)

- **PR #20:** Corrected Electron's main entry to `out/main/index.js`,
  generated the sandbox-compatible preload as CommonJS `out/preload/index.js`,
  and fixed Windows canonical paths when a protected location contains
  nonexistent descendants. `sandbox: true`, `contextIsolation: true`, and
  `nodeIntegration: false` remain unchanged.
- **PR #21:** Added `verify:build` to check actual emitted files, preload
  module syntax, and security settings after each Electron build. Negative
  regression tests cover the original broken entry and ESM preload cases.
  This CI verification does not replace a visual Windows desktop smoke test.

### First-party harness context (PR #19)

- Added an explicitly refreshed, read-only **Agent / Model / Saved session**
  context bar to the shared Chat/Omega workspace. Three fixed GET-only
  calls to the existing 127.0.0.1 GUI are bounded and stripped in the
  Electron main process so credentials, agent prompts, other session
  names and message bodies are not returned to the UI.
- Existing runtime context is **not attested** as the Live Monitor's
  particular chat session. No native send, agent/model switch, session
  resume or approval endpoint is used. Regression tests exercise
  redirection, invalid input, malformed/oversized JSON and data filtering.

### Native integration evidence collection

- **PR #18:** Added an explicit, read-only local ChatBridge
  compatibility inspector. It checks optional GUI source-file presence
  and makes at most two GET-only requests to a validated loopback
  health/OpenAPI endpoint, with blocked redirects, no raw API payload
  storage, and no WebSocket/prompt/session writes. Added Python tests
  and CI coverage. This **does not** certify native chat integration.

### Product direction and conversation-first workspace

- **Chat-first harness redesign (PR #17):** Chat is now the application's
  initial screen, with the existing installed GUI conversation presented as
  the main workspace surface. Omega is a mode of **that same mounted
  conversation**, showing the animated orchestration graph alongside chat
  rather than opening a separate harness/dock. The Omega draft composer is
  accessed from a workspace drawer; saved activity, logs, worker briefs
  and project docs remain available in the sidebar.
- Added `docs/HARNESS_APP.md` to document the native session-bound
  chat/backend goal and the verified-runtime requirement. The current
  embedded GUI remains an **interim transport** and automatic dispatch
  is still disabled. Added UI composition tests.

### User-facing features
- **PR #5:** Introduced the dark Electron orchestration command center,
  overview-first navigation, animated workflow SVG, labeled Demo playback,
  saved-record mode and sidebar/settings layout.
- **PR #6:** Added bounded, read-only live event projection with explicit
  disconnected/error/approval states and WebSocket integration tests.
- **PR #8:** Added explicit GUI launch from a validated project workspace;
  existing external GUI sessions keep an unverified working-directory warning.
- **PR #9:** Added the real embedded Puppy GUI chat dock beside the animated
  workflow, with project selection and explicit acknowledgement for unverified
  external sessions.
- **PR #12:** Added explicit, GET-only loopback runtime diagnostics in Settings;
  endpoint responses do **not** establish native chat-send compatibility.
- **PR #13:** Added searchable, persistent Saved activity, detail/copy/open-chat
  actions, and removed the raw active-session JSON dump. Draft-save IPC now
  rejects fabricated run completions and check passes; history reads preserve
  older long records and more than 2,000 entries.
- **PR #14:** Made the read-only ChatBridge Live Monitor opt-in. Opening Omega,
  opening its chat dock, or switching to Live no longer starts the extra
  observation socket. Stop monitor closes that socket and cancels retries.
- **Event Log improvement:** Added a sidebar log view over the existing bounded,
  sanitized in-memory events, with search, severity/worker filters, and explicit
  monitor controls. No raw transcript storage or automatic dispatch.

### Safety and reliability
- **PRs #1 and #3:** Installer/reliability foundation and reflect-skill updates.
- **PR #7:** Protected global Code Puppy locations, Python environments,
  GUI source checkouts and installer symlink/junction redirects; made desktop
  startup attach-only; propagated core-isolation instructions to workers.
- **PR #10:** Addressed older Codex findings around complete virtualenv
  protection, autodiscovered GUI locations, system Python differentiation,
  disconnect/cancel worker states, and paused Demo animations.
- **PRs #11–#14:** Audited previously merged PR feedback, resolved reported
  findings, checked cleanup jobs, and removed superseded/merged branches.
  Cleanup workflows were deleted after use; `main` was the only branch at
  the end of the previous pass.
- Added unit/integration checks for installer safety, workflow status,
  socket lifecycle, webview navigation restrictions, runtime diagnostics
  and draft validation.

### Current limits (not shipped or verified)
- **Native chat send / automatic run dispatch:** intentionally disabled.
  Users submit copied briefs through the existing Puppy GUI.
- **Event-to-chat-session matching:** not verified against the installed
  `puppy_gui` backend; WebSocket connection alone is not proof.
- **Project cwd attestation:** starting an owned GUI with a selected `cwd`
  is implemented, but runtime cwd after startup is not independently verified.
- **Manual desktop smoke, packaging installers, real runtime approval and
  file-write isolation tests:** still pending.
- **Model aliases, prices and provider availability:** historical research
  examples, not verified against the user's installed provider/runtime.

See [current status](docs/STATUS.md), [manual verification checklist](docs/LOCAL_QA.md),
and [GitHub milestone tracker](https://github.com/ant3869/puppy-omega-one/issues/4).

## Historical maintenance
- **PR #2** was closed as superseded by merged PR #1 and was **not merged**.
- The work above consists of merged PRs and CI-checked code, not a stable,
  end-to-end Code Puppy orchestration API.
