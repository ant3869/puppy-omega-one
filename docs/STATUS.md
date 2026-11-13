# Current implementation status

Updated 2026-11-13. This document describes code merged in prior PRs and the
**direct ACP integration branch**; an unmerged branch is not a release.

## Implemented in code

- Chat-first React/Electron app; Omega loop is a second view of **the same
  mounted conversation**.
- Direct native Code Puppy **ACP v1 over subprocess stdin/stdout**:
  `code-puppy --acp`, initialize, project-bound `session/new`,
  `session/prompt`, streamed `session/update`, cancel and stop.
- No GUI subprocess, embedded GUI webview, HTTP GUI server, or ChatBridge
  monitor. A selected Code Puppy process and ACP session are owned by Omega.
- Existing project-safe selection, draft-only run storage, project-local
  templates and protected-path guardrails remain.
- Optional live monitor projects observed ACP turn/tool activity from that
  same session. Demo is explicitly simulated and Saved is local records.
- ACP `session/request_permission` is denied. No client filesystem or
  terminal capability is advertised; no silent user approvals.
- Mock subprocess tests cover handshake, selected cwd, streaming, permission
  denial, missing executable and refusal to send before a session exists.
- Electron build/test/typecheck and installer safety CI are available.

## Still unverified or unfinished

- **Native installed-runtime validation** on the user's Windows machine.
  CI uses a disposable mock ACP process; it cannot prove the local Code Puppy
  version starts, authenticates to a model, or obeys intended tool policies.
- Live event mapping to individual specialist **worker identities**, work
  products, check execution and verified pass/fail outcomes.
- An interactive, safe approval UI. Tool permissions stay denied for now.
- Recovering a selected ACP session after restart, graceful cancel under
  long-running local commands, media/attachments, model/agent selection.
- Automatic Omega delegation, bounded retries, independent checks and
  durable execution history (beyond draft records).
- Manual keyboard, responsiveness, desktop smoke and packaged installer QA.
- Agent tools run under the OS user. Project selection and instructions are
  **not a sandbox**, and do not guarantee prevention of external writes.
- Live monitor records summaries only and does not verify specialist success.

## Next milestone

On a disposable **project**, start installed Code Puppy using the native app,
send a harmless read-only message, inspect streamed output, and verify
cancellation and denial of dangerous tool requests. Compare the project cwd
and record the Code Puppy/ACP version. This has not been performed here.

Then bind verified sub-agent tool-call metadata to worker lanes and build a
controlled Omega orchestration test run. See [QA](LOCAL_QA.md) and
[tracker #4](https://github.com/ant3869/puppy-omega-one/issues/4).
