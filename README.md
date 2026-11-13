<img src="assets/logo.png" alt="Puppy Omega One" width="320">

# Puppy Omega One

**A first-party Code Puppy coding workspace with an Omega orchestration mode.**

Chat talks **directly to Code Puppy** using its built-in
[Agent Client Protocol (ACP)](https://agentclientprotocol.com/).
There is **no Puppy GUI integration, embedded webview, HTTP server or
ChatBridge WebSocket**. Omega's orchestration view lives beside that same
direct conversation.

## Get started

Prerequisites: Node.js 22+, Python 3.11+, and an installed Code Puppy version
with the official ACP plugin providing `code-puppy --acp`.

```powershell
cd electron; npm install; npm test; npm run typecheck; npm run build; npm run dev
```

If `code-puppy` is not on PATH, set `CODE_PUPPY_EXECUTABLE` to the full path
to the installed executable before launching the Electron app. This project
does not install, update or modify the Code Puppy runtime.

1. Open **Chat**, click **Choose project**, and select a disposable project
   for initial tests.
2. Click **Start Code Puppy**. Omega spawns `code-puppy --acp` in that
   project, performs the ACP initialize handshake, and opens one session
   with `session/new(cwd=selectedProject)`.
3. Type a message and click **Send**. Response text, thoughts and tool
   activity stream through that same ACP session. **Cancel** sends
   `session/cancel`; **Stop** closes the child started by Omega.
4. Switch to **Omega loop** without remounting the conversation. Demo is
   illustrated; Saved shows local draft records; the optional Live view
   displays observed events from the direct ACP chat session.
5. **Draft Omega job** prepares an orchestrator brief. Saving the draft
   does not run it; submit a reviewed brief manually through Chat.

### Important limits

**Native ACP chat is implemented in the repository, but has not yet been
verified against the user's installed Code Puppy version or desktop UI.**
The automated test suite uses a harmless ACP mock process. Real API tokens,
models, runtime plugins and tool behavior are outside CI.

The adapter intentionally advertises **no delegated filesystem/terminal
capabilities**, denies ACP `session/request_permission` requests, and does not
expose an approval button yet. This does not sandbox Code Puppy: the installed
agent process runs with your OS permissions and may have existing configuration,
plugins, or tools. Do not test with important files until you have checked
its actual agent permissions and project scope.

**Omega orchestration is not automatically dispatched yet.** Generic tool
activity is observed, but a worker's result is *not* a verified acceptance
check. See [implementation status](docs/STATUS.md).

## Omega project templates

| Agent | Intended role |
| --- | --- |
| `omega-orchestrator` | Plan, delegate, inspect results, rerun acceptance checks |
| `omega-researcher` | Investigate relevant files/context |
| `omega-builder` | Implement narrowly scoped changes |
| `omega-tester` | Run focused checks |
| `omega-reviewer` | Review diffs and failure risks |

Project templates can be installed into a **selected project only**:

```powershell
.\install.ps1 -Target "C:\path\to\your-project"
```

Linux/macOS: `./install.sh /path/to/your-project`.

Protected Code Puppy core/configuration, virtualenv and redirected workspace
locations are rejected. No global configuration is intentionally modified by
the template installer.

## Documentation

[Status](docs/STATUS.md) ·
[Architecture](docs/ARCHITECTURE.md) ·
[Native ACP integration](docs/HARNESS_APP.md) ·
[Frontend](docs/FRONTEND.md) ·
[Safe local QA](docs/LOCAL_QA.md) ·
[Changelog](CHANGELOG.md) ·
[Progress tracker](https://github.com/ant3869/puppy-omega-one/issues/4)
