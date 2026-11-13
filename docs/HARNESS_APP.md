# Puppy Omega One — harness application direction

> Product decision: **Puppy Omega One is a coding-agent application.**
> The Omega orchestrator/worker loop is its signature **execution mode**,
> not a separate dashboard layered over another application.

## The intended everyday experience

1. Open the application in **Chat**, choose a project and use an ordinary
   agent conversation with files, tools, models, sessions and approvals.
2. When a task benefits from specialists, choose **Omega loop** from
   that same workspace. The conversation stays on screen; the graph
   provides orchestration context alongside it.
3. Use **Draft Omega job** to compose a structured goal, acceptance
   check and proposed worker lanes. The user explicitly submits the
   brief in the conversation until native session binding is verified.
4. The user should not have to think in terms of a separate “Harness
   GUI”, “Omega console” or two disconnected applications.
5. Navigation to history, briefs, logs and project docs is part of
   the **same application**, not a separate control center.

## What is implemented in the chat-first UI pass

- Chat is the **default landing route**, not an animated dashboard.
- Chat and Omega loop are **modes of the same mounted workspace**.
  Switching modes does not deliberately remount the conversation webview.
- Omega mode displays the animated graph **beside** that conversation.
  Demo, Saved and Live sources retain their honest labels.
- The Omega job composer is accessible **inside** the workspace.
  The existing draft-only save, clipboard and core-isolation guards
  remain in place.
- Saved activity, event log, worker briefs, project docs and Settings
  remain first-party navigation destinations.
- Opening the app does not start Code Puppy or connect the extra
  observation WebSocket. Native prompt send is still disabled.

## Current transport limitation — do not hide it

The central conversation is still rendered by an **embedded instance
of the existing Puppy GUI**. This is a transitional integration, not
a claim of an independent native ChatBridge client.

Inspection of the checked-in `ant3869/puppy_gui` main branch found:
- `code_puppy_gui/static/js/chat.js` sends WebSocket actions such as
  `{ action: "prompt", text }` and renders tool/approval messages.
- `tests/test_ws.py` describes prompt, response, cancel and ping.
- `code_puppy_gui/app.py` imports `routes_chat`, but
  `code_puppy_gui/api/routes_chat.py` **is absent from the checked-in
  main tree reviewed** (along with other imported route modules).
  Therefore **this checkout alone cannot verify** the actual installed
  route, session ownership or approval contract.

**Do not** replace the webview with an attractive nonfunctional
fake chat, send a prompt over a guessed route, or quietly share a
WebSocket session without verifying how the installed server behaves.

## Next engineering phases

### Non-mutating preflight tool now available

Run `python tools/inspect_chatbridge.py --gui-root <existing-puppy_gui-dir>`
against a local GUI, or add `--offline` to inspect files without HTTP.
This checks only local source-file presence and GET-only health/OpenAPI
route declarations. It does **not** open `/ws/chat` or attest project
cwd, agent selections, session/approval ownership or response events.

This is a safe **first step**, not Phase A completion. The installed
runtime's actual WebSocket/session behavior still needs manual verification
with a disposable project and redacted fixtures.

### Phase A — verify a real installed backend

- Test against a deliberately disposable project and installed GUI.
- Verify chat route availability and **whether connecting creates
  or changes sessions**, including reconnect/multiple subscribers.
- Verify how agents, model selection, project `cwd`, transcript
  history, tool approvals and cancellation are associated with a
  single session.
- Capture a **redacted protocol fixture** and add contract tests.
- Never submit destructive tasks or change global Code Puppy config
  merely to probe integration.

### Native, non-mutating harness context now available

The shared Chat/Omega workspace includes explicit **Refresh context**:
three fixed, bounded GET calls to the local GUI read the active agent,
model and current saved-session label. The main process **discards**
all raw model/agent/session metadata before returning those short names
to the UI. No automatic polling or switching is enabled. The session
label is not a verified ChatBridge session ID and does not establish
workspace identity. This is **not** the native chat adapter.

### Phase B — genuine first-party conversation frontend

Once verified, implement a **single session-bound backend adapter**
and native conversation UI. It must handle:
- message send/stream, tool invocation and results, nested workers;
- agent/model/session selection, file context and transcript resume;
- prompt approvals, cancellation and reconnect without replaying
  side-effecting actions;
- errors, permission boundaries and exact current project identity.

The embedded GUI may remain an **explicit compatibility fallback**,
but it must not be sold as native chat. One conversation owns its
session and one event stream drives both chat and Omega graph.

### Phase C — orchestration as first-class behavior

- User chooses **Chat** or **Omega loop** with one conversation and
  current project/session.
- Dispatch is explicit and uses verified session/agent APIs.
- The graph visualizes **actual** delegation, validation, retries
  and approvals. No invented progress or check passes.
- Omega's orchestration policy can coexist with general chat,
  rather than requiring an entirely different app/harness.

## Acceptance criteria

- [x] Chat-first route with Omega as workspace mode.
- [x] Same conversation component persists while switching modes.
- [x] Draft composer integrated without enabling unsafe dispatch.
- [ ] Native chat send, stream, approvals and cancellation verified.
- [ ] Model/agent/session picker within the first-party chat UI.
- [ ] Confirm current project and runtime session ID from backend.
- [ ] Manual desktop UX and real backend tests.
- [ ] Retire the embedded GUI as the default transport.

This decision supersedes the earlier description of a
“dashboard first” app; the previous SVG design remains a major
**feature of the Omega mode** rather than the app's definition.
