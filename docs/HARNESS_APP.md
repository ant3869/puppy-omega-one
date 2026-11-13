# Native Code Puppy ACP integration

**Architectural decision (2026-11-13): Puppy Omega One does not integrate
with a separate Puppy GUI.** The product is a native chat-first coding-agent
application. The Omega loop is a mode of one conversation.

## Direct runtime boundary

The installed Code Puppy core plugins ship `code-puppy --acp`, implementing
Agent Client Protocol v1 JSON-RPC over stdio. Relevant upstream sources:

- [ACP implementation and limitations](https://github.com/mpfaffenberger/code_puppy_core_plugins/blob/main/code_puppy_core_plugins/acp/README.md)
- [ACP CLI registration](https://github.com/mpfaffenberger/code_puppy_core_plugins/blob/main/code_puppy_core_plugins/acp/register_callbacks.py)
- [Code Puppy CLI entry](https://github.com/mpfaffenberger/code_puppy/blob/main/code_puppy/cli_entry.py)

Electron main owns the spawned process. The renderer receives only a typed,
bounded IPC snapshot. Nothing starts automatically. On **Start** the main
process validates a selected project directory, launches `code-puppy --acp`
there, calls `initialize` and `session/new` with that cwd, then sends
`session/prompt` to the returned session id on explicit user action.

The client renders streamed `agent_message_chunk` / `agent_thought_chunk`
and tool-call summaries from `session/update`. **Cancel** sends
`session/cancel`; **Stop** ends the child it owns. Startup/network logs
and raw provider stderr are not forwarded to the UI.

## Safety and runtime uncertainty

- Requests for `session/request_permission` are answered with
  `cancelled`. No FS or terminal delegation is advertised. The planned
  first-party approval dialog must be developed and independently reviewed.
- Code Puppy itself may run other installed tools/plugins under the OS user's
  permissions. This is a cautious client, **not a sandbox**.
- ACP sessions may save state in Code Puppy's own runtime directories.
  Omega does not patch these locations or global configuration.
- CI validates a disposable *mock ACP process*, not your installed version.
  No desktop compatibility or plugin behavior has been manually attested.
- A streamed tool call and a completed chat turn do **not** establish that
  any Omega acceptance criterion passed.

## Omega execution roadmap

1. Verify native ACP handshake, cwd, tools and cancellation on a disposable
   installed runtime.
2. Collect and test actual `invoke_agent` tool-call and completion metadata
   to map specialist lanes without heuristics or fabricated telemetry.
3. Implement a bounded orchestration controller with immutable goal, checks,
   review decisions, retry limits and explicit user approval.
4. Capture proof: child task identity, file/diff evidence, command results,
   independent verification and final status. Maintain one session's ownership
   across chat and Omega; never spin up a secondary GUI event feed.
5. Add the permission UI and safe resumption before scaling up autonomous runs.

The previous GUI/ChatBridge implementation and standalone probes were
**removed** from active architecture. Do not bring them back as a fallback.
